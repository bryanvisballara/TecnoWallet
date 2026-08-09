import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UnitClient } from './unit-client';
import { UnitWorkspaceAccount } from './unit.schemas';

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

@Injectable()
export class UnitAccountService {
  constructor(
    private readonly unit: UnitClient,
    private readonly config: ConfigService,
    @InjectModel(UnitWorkspaceAccount.name)
    private readonly accounts: Model<UnitWorkspaceAccount>,
  ) {}

  async getByWorkspaceId(workspaceId: string) {
    return this.accounts.findOne({ workspaceId });
  }

  /**
   * Ensures a shared Unit deposit account exists for the recaudos workspace.
   *
   * Unit only allows `walletAccount` for business / sole-prop customers.
   * Our KYC path creates individual customers, so we open a `depositAccount`
   * (checking) that still receives ACH into the recaudo pot.
   */
  async ensureWorkspaceWallet(input: {
    workspaceId: string;
    unitCustomerId: string;
  }) {
    const existing = await this.getByWorkspaceId(input.workspaceId);
    if (existing?.unitWalletId && existing.status === 'open') {
      return existing;
    }

    const depositProduct = stripQuotes(
      this.config.get<string>('UNIT_DEPOSIT_PRODUCT') ?? 'checking',
    );

    if (!this.unit.configured) {
      return this.accounts.findOneAndUpdate(
        { workspaceId: input.workspaceId },
        {
          $set: {
            unitCustomerId: input.unitCustomerId,
            unitWalletId: `sandbox-wallet-${input.workspaceId}`,
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
      `deposit-${input.workspaceId}`,
    );
    const resource = this.unit.single(doc);
    const statusAttr = String(resource.attributes?.status ?? 'Open');
    return this.accounts.findOneAndUpdate(
      { workspaceId: input.workspaceId },
      {
        $set: {
          unitCustomerId: input.unitCustomerId,
          unitWalletId: resource.id,
          walletTerms: depositProduct,
          status: statusAttr === 'Open' ? 'open' : 'pending',
        },
      },
      { upsert: true, new: true },
    );
  }

  async requireOpenWalletId(workspaceId: string): Promise<string> {
    const account = await this.getByWorkspaceId(workspaceId);
    if (!account?.unitWalletId || account.status !== 'open') {
      throw new BadRequestException(
        'Workspace Unit wallet is not ready; complete financial setup first',
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
