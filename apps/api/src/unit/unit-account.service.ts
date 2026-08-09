import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UnitClient } from './unit-client';
import { UnitRecaudoAccount } from './unit.schemas';

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
  ) {}

  async getByRecaudoId(recaudoId: string) {
    return this.accounts.findOne({ recaudoId });
  }

  /**
   * Ensures a dedicated Unit deposit account exists for this recaudo.
   * Individual customers use depositAccount (checking); one pot per recaudo.
   */
  async ensureRecaudoWallet(input: {
    recaudoId: string;
    workspaceId: string;
    unitCustomerId: string;
  }) {
    const existing = await this.getByRecaudoId(input.recaudoId);
    if (existing?.unitWalletId && existing.status === 'open') {
      return existing;
    }

    const depositProduct = stripQuotes(
      this.config.get<string>('UNIT_DEPOSIT_PRODUCT') ?? 'checking',
    );

    if (!this.unit.configured) {
      return this.accounts.findOneAndUpdate(
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
    return this.accounts.findOneAndUpdate(
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
    );
  }

  async requireOpenWalletId(recaudoId: string): Promise<string> {
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
