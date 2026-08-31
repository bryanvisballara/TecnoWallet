import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Model, Types } from 'mongoose';

export const transactionKinds = [
  'income',
  'expense',
  'transfer',
  'refund',
  'envelope_transfer',
] as const;
export type TransactionKind = (typeof transactionKinds)[number];

export class LedgerEntryDto {
  @IsString()
  accountId!: string;

  @IsString()
  currency!: string;

  @IsInt()
  amountMinor!: number;

  @IsOptional()
  @IsString()
  envelopeId?: string;
}

export class CreateTransactionDto {
  @IsString()
  workspaceId!: string;

  @IsEnum(transactionKinds)
  kind!: TransactionKind;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerEntryDto)
  entries!: LedgerEntryDto[];
}

/** Date, description or envelope — not amounts. Amounts stay immutable. */
export class AmendTransactionDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  envelopeId?: string;
}

@Schema({ _id: false })
export class LedgerEntry {
  @Prop({ required: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency!: string;

  @Prop({ required: true })
  amountMinor!: number;

  @Prop()
  envelopeId?: Types.ObjectId;
}
export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);

@Schema({ timestamps: true, optimisticConcurrency: true })
export class LedgerTransaction {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: transactionKinds })
  kind!: TransactionKind;

  @Prop({ required: true, index: true })
  occurredAt!: Date;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop()
  categoryId?: Types.ObjectId;

  @Prop({ type: [LedgerEntrySchema], required: true })
  entries!: LedgerEntry[];

  @Prop()
  idempotencyKey?: string;

  @Prop({ index: true })
  reversedById?: Types.ObjectId;

  @Prop({ required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['workspace', 'private'],
    default: 'workspace',
  })
  privacy!: 'workspace' | 'private';

  createdAt!: Date;
}
export const LedgerTransactionSchema =
  SchemaFactory.createForClass(LedgerTransaction);
LedgerTransactionSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
LedgerTransactionSchema.index({ workspaceId: 1, occurredAt: -1, _id: -1 });
LedgerTransactionSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'],
  function immutableTransaction() {
    throw new Error('Ledger transactions are immutable; create a reversal');
  },
);

export function assertValidMoney(amountMinor: number, currency: string): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new BadRequestException('Money must use safe integer minor units');
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException('Currency must be uppercase ISO 4217');
  }
}

export function assertBalancedTransaction(dto: CreateTransactionDto): void {
  if (dto.entries.length < 2) {
    throw new BadRequestException(
      'A transaction requires at least two entries',
    );
  }
  const totals = new Map<string, number>();
  for (const entry of dto.entries) {
    assertValidMoney(entry.amountMinor, entry.currency);
    if (entry.amountMinor === 0) {
      throw new BadRequestException('Ledger entries cannot be zero');
    }
    totals.set(
      entry.currency,
      (totals.get(entry.currency) ?? 0) + entry.amountMinor,
    );
  }
  if ([...totals.values()].some((total) => total !== 0)) {
    throw new BadRequestException('Entries must balance to zero per currency');
  }
  if (
    dto.kind === 'envelope_transfer' &&
    dto.entries.some((entry) => !entry.envelopeId)
  ) {
    throw new BadRequestException(
      'Envelope transfers require an envelope on every entry',
    );
  }
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(LedgerTransaction.name)
    private readonly transactions: Model<LedgerTransaction>,
  ) {}

  async create(dto: CreateTransactionDto, ownerId: string) {
    assertBalancedTransaction(dto);
    if (dto.idempotencyKey) {
      const prior = await this.transactions.findOne({
        workspaceId: dto.workspaceId,
        idempotencyKey: dto.idempotencyKey,
      });
      if (prior) return prior;
    }
    return this.transactions.create({
      ...dto,
      ownerId,
      privacy: dto.private ? 'private' : 'workspace',
    });
  }

  async reverse(transactionId: string, userDescription?: string) {
    const original = await this.transactions.findById(transactionId);
    if (!original) throw new BadRequestException('Transaction not found');
    if (original.reversedById) {
      throw new BadRequestException('Transaction was already reversed');
    }
    const reversal = await this.transactions.create({
      workspaceId: original.workspaceId,
      kind: 'refund',
      occurredAt: new Date(),
      description: userDescription ?? `Reversal: ${original.description}`,
      ownerId: original.ownerId,
      privacy: original.privacy,
      entries: original.entries.map((entry) => ({
        accountId: entry.accountId,
        currency: entry.currency,
        envelopeId: entry.envelopeId,
        amountMinor: -entry.amountMinor,
      })),
    });
    original.reversedById = reversal._id;
    await original.save();
    return reversal;
  }

  /**
   * Change date / description / envelope without touching money.
   * Uses document.save() so the query-immutability hook does not fire.
   */
  async amendMetadata(transactionId: string, patch: AmendTransactionDto) {
    const original = await this.transactions.findById(transactionId);
    if (!original) {
      throw new BadRequestException('Transaction not found');
    }
    if (original.reversedById) {
      throw new BadRequestException('Transaction was already reversed');
    }
    if (original.kind === 'refund') {
      throw new BadRequestException('Refunds cannot be amended');
    }
    const hasDate = Boolean(patch.occurredAt);
    const hasDescription = patch.description !== undefined;
    const hasEnvelope = patch.envelopeId !== undefined;
    if (!hasDate && !hasDescription && !hasEnvelope) {
      throw new BadRequestException('Nothing to amend');
    }
    if (hasDate) {
      const occurredAt = new Date(patch.occurredAt as string);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new BadRequestException('occurredAt must be a valid date');
      }
      original.occurredAt = occurredAt;
    }
    if (hasDescription) {
      const description = (patch.description ?? '').trim();
      if (!description) {
        throw new BadRequestException('description cannot be empty');
      }
      original.description = description;
    }
    if (hasEnvelope) {
      const raw = (patch.envelopeId ?? '').trim();
      const envelopeObjectId = raw
        ? Types.ObjectId.isValid(raw)
          ? new Types.ObjectId(raw)
          : null
        : null;
      if (raw && !envelopeObjectId) {
        throw new BadRequestException('envelopeId is not valid');
      }
      for (const entry of original.entries) {
        const userFacing =
          (original.kind === 'income' && entry.amountMinor > 0) ||
          (original.kind === 'expense' && entry.amountMinor < 0);
        if (!userFacing) continue;
        entry.envelopeId = envelopeObjectId ?? undefined;
      }
      original.markModified('entries');
    }
    return original.save();
  }

  /** Void every open movement that touches this account (cascade on account delete). */
  async reverseAllForAccount(accountId: string, userDescription?: string) {
    if (!Types.ObjectId.isValid(accountId)) return 0;
    const accountObjectId = new Types.ObjectId(accountId);
    const open = await this.transactions
      .find({
        'entries.accountId': accountObjectId,
        reversedById: { $exists: false },
        kind: { $ne: 'refund' },
      })
      .select('_id')
      .lean()
      .exec();

    let reversed = 0;
    for (const row of open) {
      try {
        await this.reverse(
          String(row._id),
          userDescription ?? 'Cuenta eliminada',
        );
        reversed += 1;
      } catch {
        // Already reversed in a race — keep going.
      }
    }
    return reversed;
  }

  /**
   * Current cash per account from the ledger (not the cached resource balanceMinor).
   * Accounts that never appear in a movement are omitted so callers keep the opening balance.
   */
  async accountBalancesMinor(workspaceId: string, userId?: string) {
    const balances = new Map<string, number>();
    if (!Types.ObjectId.isValid(workspaceId)) return balances;
    const privacy =
      userId && Types.ObjectId.isValid(userId)
        ? {
            $or: [
              { privacy: { $ne: 'private' } },
              {
                privacy: 'private',
                ownerId: new Types.ObjectId(userId),
              },
            ],
          }
        : { privacy: { $ne: 'private' } };
    const rows = await this.transactions.aggregate<{
      _id: Types.ObjectId;
      balanceMinor: number;
    }>([
      {
        $match: {
          workspaceId: new Types.ObjectId(workspaceId),
          reversedById: { $exists: false },
          kind: { $ne: 'refund' },
          ...privacy,
        },
      },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.accountId',
          balanceMinor: { $sum: '$entries.amountMinor' },
        },
      },
    ]);
    for (const row of rows) {
      if (!row?._id) continue;
      balances.set(String(row._id), Number(row.balanceMinor) || 0);
    }
    return balances;
  }
}
