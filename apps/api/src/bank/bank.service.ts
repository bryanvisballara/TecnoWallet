import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership } from '../auth/auth.module';
import { CreateTransactionDto, LedgerService } from '../ledger/ledger';
import { BelvoClient, type BelvoTransaction } from './belvo.client';
import { BankConnection, PendingBankTransaction } from './bank.schemas';

function toMinor(amount: number, currency: string) {
  const zeroDecimal = ['COP', 'CLP', 'JPY', 'KRW', 'VND', 'PYG'].includes(
    currency.toUpperCase(),
  );
  if (zeroDecimal) return Math.round(Math.abs(amount));
  return Math.round(Math.abs(amount) * 100);
}

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class BankService {
  constructor(
    private readonly belvo: BelvoClient,
    private readonly ledger: LedgerService,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(BankConnection.name)
    private readonly connections: Model<BankConnection>,
    @InjectModel(PendingBankTransaction.name)
    private readonly pending: Model<PendingBankTransaction>,
  ) {}

  private async assertMember(workspaceId: string, userId: string) {
    const member = await this.memberships.exists({ workspaceId, userId });
    if (!member) throw new ForbiddenException('Workspace access denied');
  }

  status() {
    return {
      provider: 'belvo' as const,
      configured: this.belvo.configured(),
      apiUrl: this.belvo.configured()
        ? undefined
        : 'Set BELVO_SECRET_ID and BELVO_SECRET_PASSWORD',
    };
  }

  async createWidgetToken(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    if (!this.belvo.configured()) {
      throw new ServiceUnavailableException('Belvo is not configured');
    }
    const token = await this.belvo.createWidgetToken();
    return {
      access: token.access,
      widgetUrl: `https://widget.belvo.io/?access_token=${encodeURIComponent(token.access)}&locale=es`,
    };
  }

  async registerLink(input: {
    workspaceId: string;
    userId: string;
    belvoLinkId: string;
    institutionName?: string;
    institutionCode?: string;
  }) {
    await this.assertMember(input.workspaceId, input.userId);
    if (!input.belvoLinkId.trim()) {
      throw new BadRequestException('belvoLinkId is required');
    }

    let institutionName = input.institutionName?.trim();
    let institutionCode = input.institutionCode?.trim();
    try {
      const link = await this.belvo.getLink(input.belvoLinkId.trim());
      institutionCode = institutionCode || link.institution;
      institutionName = institutionName || link.institution;
    } catch {
      // Widget may return the link before Belvo GET is ready; keep client labels.
    }

    const connection = await this.connections.findOneAndUpdate(
      { belvoLinkId: input.belvoLinkId.trim() },
      {
        $set: {
          workspaceId: new Types.ObjectId(input.workspaceId),
          userId: new Types.ObjectId(input.userId),
          provider: 'belvo',
          institutionName,
          institutionCode,
          status: 'active',
        },
        $setOnInsert: {
          belvoLinkId: input.belvoLinkId.trim(),
        },
      },
      { upsert: true, new: true },
    );

    await this.syncConnection(connection._id.toString(), input.userId);
    return this.serializeConnection(connection);
  }

  async listConnections(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const rows = await this.connections
      .find({ workspaceId, userId })
      .sort({ updatedAt: -1 });
    return rows.map((row) => this.serializeConnection(row));
  }

  async syncWorkspace(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const rows = await this.connections.find({
      workspaceId,
      userId,
      status: 'active',
    });
    let imported = 0;
    for (const row of rows) {
      imported += await this.syncConnection(row._id.toString(), userId);
    }
    return { syncedConnections: rows.length, importedPending: imported };
  }

  /** Called from Belvo webhooks (no user session). */
  async syncByBelvoLinkId(belvoLinkId: string) {
    const connection = await this.connections.findOne({
      belvoLinkId: belvoLinkId.trim(),
      status: 'active',
    });
    if (!connection) {
      return { matched: false, importedPending: 0 };
    }
    const imported = await this.syncConnection(
      connection._id.toString(),
      connection.userId.toString(),
    );
    return { matched: true, importedPending: imported };
  }

  async listPending(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const rows = await this.pending
      .find({ workspaceId, userId, status: 'pending' })
      .sort({ occurredAt: -1 })
      .limit(100);
    return rows.map((row) => this.serializePending(row));
  }

  async dismissPending(id: string, userId: string) {
    const row = await this.pending.findById(id);
    if (!row) throw new NotFoundException('Pending transaction not found');
    await this.assertMember(row.workspaceId.toString(), userId);
    if (row.userId.toString() !== userId) {
      throw new ForbiddenException('Not your pending transaction');
    }
    row.status = 'dismissed';
    await row.save();
    return this.serializePending(row);
  }

  async confirmPending(input: {
    id: string;
    userId: string;
    accountId: string;
    clearingAccountId: string;
  }) {
    const row = await this.pending.findById(input.id);
    if (!row) throw new NotFoundException('Pending transaction not found');
    await this.assertMember(row.workspaceId.toString(), input.userId);
    if (row.userId.toString() !== input.userId) {
      throw new ForbiddenException('Not your pending transaction');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('Transaction already resolved');
    }
    if (!Types.ObjectId.isValid(input.accountId)) {
      throw new BadRequestException('accountId inválido');
    }
    if (!Types.ObjectId.isValid(input.clearingAccountId)) {
      throw new BadRequestException('clearingAccountId inválido');
    }

    const signed =
      row.kind === 'income' ? row.amountMinor : -Math.abs(row.amountMinor);
    const dto: CreateTransactionDto = {
      workspaceId: row.workspaceId.toString(),
      kind: row.kind,
      occurredAt: row.occurredAt.toISOString(),
      description: row.merchantName || row.description,
      idempotencyKey: `belvo:${row.belvoTransactionId}`,
      entries: [
        {
          accountId: input.accountId,
          currency: row.currency,
          amountMinor: signed,
        },
        {
          accountId: input.clearingAccountId,
          currency: row.currency,
          amountMinor: -signed,
        },
      ],
    };

    const created = await this.ledger.create(dto, input.userId);
    row.status = 'accepted';
    row.ledgerTransactionId = created._id;
    await row.save();
    return {
      pending: this.serializePending(row),
      transactionId: created._id.toString(),
    };
  }

  private async syncConnection(connectionId: string, userId: string) {
    const connection = await this.connections.findById(connectionId);
    if (!connection) return 0;
    if (connection.userId.toString() !== userId) {
      throw new ForbiddenException('Not your bank connection');
    }

    const dateFrom = isoDate(45);
    const dateTo = isoDate(0);
    let txs: BelvoTransaction[] = [];
    try {
      txs = await this.belvo.retrieveTransactions(
        connection.belvoLinkId,
        dateFrom,
        dateTo,
      );
    } catch {
      txs = await this.belvo.listTransactions({
        linkId: connection.belvoLinkId,
        dateFrom,
        dateTo,
      });
    }

    let imported = 0;
    for (const tx of txs) {
      if (!tx?.id || typeof tx.amount !== 'number') continue;
      const currency = (tx.currency || 'COP').toUpperCase();
      const kind: 'income' | 'expense' = tx.amount >= 0 ? 'income' : 'expense';
      const amountMinor = toMinor(tx.amount, currency);
      if (amountMinor <= 0) continue;
      const occurredRaw = tx.value_date || tx.accounting_date;
      const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date();
      const description =
        tx.merchant?.name?.trim() ||
        tx.description?.trim() ||
        'Movimiento bancario';

      const result = await this.pending.updateOne(
        {
          workspaceId: connection.workspaceId,
          belvoTransactionId: tx.id,
        },
        {
          $setOnInsert: {
            workspaceId: connection.workspaceId,
            connectionId: connection._id,
            userId: connection.userId,
            belvoTransactionId: tx.id,
            belvoAccountId: tx.account,
            description,
            merchantName: tx.merchant?.name?.trim(),
            amountMinor,
            currency,
            kind,
            occurredAt,
            status: 'pending',
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount) imported += 1;
    }

    connection.lastSyncedAt = new Date();
    await connection.save();
    return imported;
  }

  private serializeConnection(row: BankConnection) {
    return {
      id: row._id.toString(),
      workspaceId: row.workspaceId.toString(),
      provider: row.provider,
      belvoLinkId: row.belvoLinkId,
      institutionName: row.institutionName ?? row.institutionCode ?? 'Banco',
      institutionCode: row.institutionCode,
      status: row.status,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      createdAt: row.createdAt?.toISOString?.() ?? undefined,
    };
  }

  private serializePending(row: PendingBankTransaction) {
    return {
      id: row._id.toString(),
      workspaceId: row.workspaceId.toString(),
      connectionId: row.connectionId.toString(),
      description: row.description,
      merchantName: row.merchantName,
      amountMinor: row.amountMinor,
      currency: row.currency,
      kind: row.kind,
      occurredAt: row.occurredAt.toISOString(),
      status: row.status,
      ledgerTransactionId: row.ledgerTransactionId?.toString() ?? null,
    };
  }
}
