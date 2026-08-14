import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Recaudo } from '../recaudos/recaudos.module';
import { isDigitalCurrency, isDigitalInactive } from '../recaudos/recaudo-digital-pricing';
import { UnitClient } from './unit-client';
import { UnitRecaudoAccount } from './unit.schemas';

type OpenRecaudoWallet = UnitRecaudoAccount & { unitWalletId: string };

function requireOpenWallet(
  account: UnitRecaudoAccount | null,
): OpenRecaudoWallet {
  if (!account?.unitWalletId) {
    throw new BadRequestException('No se pudo abrir la cuenta digital');
  }
  return account as OpenRecaudoWallet;
}

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

@Injectable()
export class UnitAccountService {
  constructor(
    private readonly unit: UnitClient,
    private readonly config: ConfigService,
    @InjectModel(UnitRecaudoAccount.name)
    private readonly accounts: Model<UnitRecaudoAccount>,
    @InjectModel(Recaudo.name)
    private readonly recaudos: Model<Recaudo>,
  ) {}

  async getByRecaudoId(recaudoId: string) {
    return this.accounts.findOne({ recaudoId });
  }

  /**
   * Opens the Bridge/Unit pot only for a digital recaudo, and only when money
   * is about to move (first funded contribution) — never at recaudo create.
   */
  async ensureRecaudoWallet(input: {
    recaudoId: string;
    workspaceId: string;
    unitCustomerId: string;
  }): Promise<OpenRecaudoWallet> {
    const recaudo = await this.recaudos.findById(input.recaudoId);
    if (!recaudo || recaudo.deletedAt) {
      throw new NotFoundException('Recaudo not found');
    }
    if (recaudo.payoutMethod !== 'digital') {
      throw new BadRequestException(
        'Este recaudo usa cuenta personal. No se abre cuenta Bridge.',
      );
    }
    if (!isDigitalCurrency(recaudo.currency)) {
      throw new BadRequestException(
        'La cuenta digital guarda el pozo en USDC.',
      );
    }
    if (recaudo.status !== 'open' || recaudo.digitalClosedAt) {
      throw new BadRequestException('Este recaudo digital ya está cerrado.');
    }
    if (isDigitalInactive(recaudo.lastDigitalActivityAt)) {
      await this.closeWallet(input.recaudoId);
      throw new BadRequestException(
        'La cuenta digital se cerró por 30 días inactiva.',
      );
    }

    const existing = await this.getByRecaudoId(input.recaudoId);
    if (existing?.unitWalletId && existing.status === 'open') {
      return requireOpenWallet(existing);
    }

    const depositProduct = stripQuotes(
      this.config.get<string>('UNIT_DEPOSIT_PRODUCT') ?? 'checking',
    );

    if (!this.unit.configured) {
      return requireOpenWallet(
        await this.accounts.findOneAndUpdate(
          { recaudoId: input.recaudoId },
          {
            $set: {
              workspaceId: input.workspaceId,
              unitCustomerId: input.unitCustomerId,
              unitWalletId: `sandbox-wallet-${input.recaudoId}`,
              walletTerms: depositProduct,
              status: 'open',
            },
          },
          { upsert: true, new: true },
        ),
      );
    }

    const doc = await this.unit.post(
      '/accounts',
      {
        data: {
          type: 'depositAccount',
          attributes: {
            depositProduct,
            tags: {
              tecnowalletRecaudoId: input.recaudoId,
              tecnowalletWorkspaceId: input.workspaceId,
              purpose: 'recaudo',
            },
          },
          relationships: {
            customer: {
              data: {
                type: 'customer',
                id: input.unitCustomerId,
              },
            },
          },
        },
      },
      `deposit-recaudo-${input.recaudoId}`,
    );
    const resource = this.unit.single(doc);
    const statusAttr = String(resource.attributes?.status ?? 'Open');
    return requireOpenWallet(
      await this.accounts.findOneAndUpdate(
        { recaudoId: input.recaudoId },
        {
          $set: {
            workspaceId: input.workspaceId,
            unitCustomerId: input.unitCustomerId,
            unitWalletId: resource.id,
            walletTerms: depositProduct,
            status: statusAttr === 'Open' ? 'open' : 'pending',
          },
        },
        { upsert: true, new: true },
      ),
    );
  }

  async closeWallet(recaudoId: string) {
    return this.accounts.findOneAndUpdate(
      { recaudoId },
      { $set: { status: 'closed' } },
      { new: true },
    );
  }

  async requireOpenWalletId(recaudoId: string): Promise<string> {
    const recaudo = await this.recaudos.findById(recaudoId);
    if (recaudo && (recaudo.digitalClosedAt || recaudo.status !== 'open')) {
      await this.closeWallet(recaudoId);
      throw new BadRequestException('Este recaudo digital ya está cerrado.');
    }
    if (recaudo && isDigitalInactive(recaudo.lastDigitalActivityAt)) {
      await this.closeWallet(recaudoId);
      throw new BadRequestException(
        'La cuenta digital se cerró por 30 días inactiva.',
      );
    }
    const account = await this.getByRecaudoId(recaudoId);
    if (!account?.unitWalletId || account.status !== 'open') {
      throw new BadRequestException(
        'Este recaudo aún no tiene cuenta digital abierta',
      );
    }
    return account.unitWalletId;
  }

  async markWalletOpen(unitWalletId: string) {
    return this.accounts.findOneAndUpdate(
      { unitWalletId },
      { $set: { status: 'open' } },
      { new: true },
    );
  }
}
