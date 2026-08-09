import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UnitClient } from './unit-client';
import { UnitWorkspaceAccount } from './unit.schemas';

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
   * Ensures a shared FBO Wallet exists for the workspace.
   * Uses BusinessCustomer/org customer id provided by ops or creates sandbox stub.
   */
  async ensureWorkspaceWallet(input: {
    workspaceId: string;
    unitCustomerId: string;
  }) {
    const existing = await this.getByWorkspaceId(input.workspaceId);
    if (existing?.unitWalletId && existing.status === 'open') {
      return existing;
    }

    const walletTerms =
      this.config.get<string>('UNIT_WALLET_TERMS') ?? 'walletDefault';

    if (!this.unit.configured) {
      return this.accounts.findOneAndUpdate(
        { workspaceId: input.workspaceId },
        {
          $set: {
            unitCustomerId: input.unitCustomerId,
            unitWalletId: `sandbox-wallet-${input.workspaceId}`,
            walletTerms,
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
          type: 'walletAccount',
          attributes: {
            walletTerms,
            tags: {
              tecnowalletWorkspaceId: input.workspaceId,
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
      `wallet-${input.workspaceId}`,
    );
    const resource = this.unit.single(doc);
    const statusAttr = String(resource.attributes?.status ?? 'Open');
    return this.accounts.findOneAndUpdate(
      { workspaceId: input.workspaceId },
      {
        $set: {
          unitCustomerId: input.unitCustomerId,
          unitWalletId: resource.id,
          walletTerms,
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
