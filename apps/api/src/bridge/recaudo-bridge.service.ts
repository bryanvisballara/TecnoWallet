import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BridgeClient } from './bridge-client';

export type TecnoAccountStatus = 'pending_kyc' | 'ready' | 'failed';

export type TecnoVirtualAccount = {
  id: string;
  currency: string;
  paymentRails: string[];
};

export type TecnoAccountSnapshot = {
  customerId?: string;
  walletId?: string;
  walletAddress?: string;
  chain?: string;
  kycUrl?: string;
  tosUrl?: string;
  status: TecnoAccountStatus;
  virtualAccounts: TecnoVirtualAccount[];
  error?: string;
};

type BridgeCustomer = {
  id?: string;
  email?: string;
  status?: string;
};

type BridgeList<T> = {
  data?: T[];
  count?: number;
};

type BridgeWallet = {
  id?: string;
  chain?: string;
  address?: string;
};

type BridgeKycLink = {
  customer_id?: string;
  kyc_link?: string;
  tos_link?: string;
  kyc_status?: string;
};

type BridgeVirtualAccount = {
  id?: string;
  status?: string;
  source_deposit_instructions?: {
    currency?: string;
    payment_rails?: string[];
    payment_rail?: string;
  };
};

const VA_CURRENCIES = ['usd', 'cop', 'mxn', 'brl'] as const;
const WALLET_CHAIN = 'base';

@Injectable()
export class RecaudoBridgeService {
  private readonly logger = new Logger(RecaudoBridgeService.name);

  constructor(private readonly bridge: BridgeClient) {}

  async provision(input: {
    recaudoId: string;
    organizerEmail: string;
    organizerName: string;
    existingCustomerId?: string;
  }): Promise<TecnoAccountSnapshot> {
    if (!this.bridge.configured) {
      return {
        status: 'failed',
        virtualAccounts: [],
        error: 'not_configured',
      };
    }

    try {
      const identity = await this.ensureCustomer(
        input.organizerEmail,
        input.organizerName,
        input.existingCustomerId,
      );
      if (!identity.customerId) {
        return {
          status: 'pending_kyc',
          kycUrl: identity.kycUrl,
          tosUrl: identity.tosUrl,
          virtualAccounts: [],
        };
      }

      const wallet = await this.ensureWallet(
        identity.customerId,
        input.recaudoId,
      );
      if (!wallet.address || !wallet.id) {
        return {
          customerId: identity.customerId,
          status: identity.kycUrl ? 'pending_kyc' : 'failed',
          kycUrl: identity.kycUrl,
          tosUrl: identity.tosUrl,
          virtualAccounts: [],
          error: 'wallet',
        };
      }

      const virtualAccounts = await this.ensureVirtualAccounts({
        customerId: identity.customerId,
        recaudoId: input.recaudoId,
        walletAddress: wallet.address,
      });

      return {
        customerId: identity.customerId,
        walletId: wallet.id,
        walletAddress: wallet.address,
        chain: wallet.chain ?? WALLET_CHAIN,
        kycUrl: identity.kycUrl,
        tosUrl: identity.tosUrl,
        status: virtualAccounts.length > 0 ? 'ready' : 'pending_kyc',
        virtualAccounts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'provision_failed';
      this.logger.warn(`TecnoWallet account provision failed: ${message}`);
      return {
        status: 'failed',
        virtualAccounts: [],
        error: message,
      };
    }
  }

  private async ensureCustomer(
    email: string,
    name: string,
    existingCustomerId?: string,
  ): Promise<{
    customerId?: string;
    kycUrl?: string;
    tosUrl?: string;
  }> {
    if (existingCustomerId) {
      return { customerId: existingCustomerId };
    }

    const listed = await this.bridge.get<BridgeList<BridgeCustomer>>(
      `/v0/customers?limit=100`,
    );
    const match = (listed.data ?? []).find(
      (row) => row.email?.toLowerCase() === email.toLowerCase() && row.id,
    );
    if (match?.id) {
      return { customerId: match.id };
    }

    const link = await this.bridge.post<BridgeKycLink>(
      '/v0/kyc_links',
      {
        full_name: name,
        email,
        type: 'individual',
      },
      randomUUID(),
    );
    return {
      customerId: link.customer_id,
      kycUrl: link.kyc_link,
      tosUrl: link.tos_link,
    };
  }

  private async ensureWallet(customerId: string, recaudoId: string) {
    const existing = await this.bridge
      .get<BridgeList<BridgeWallet> | BridgeWallet[]>(
        `/v0/customers/${customerId}/wallets`,
      )
      .catch(() => ({ data: [] as BridgeWallet[] }));
    const rows = Array.isArray(existing)
      ? existing
      : (existing.data ?? []);
    const found = rows.find((row) => row.id && row.address);
    if (found) return found;

    return this.bridge.post<BridgeWallet>(
      `/v0/customers/${customerId}/wallets`,
      { chain: WALLET_CHAIN },
      `recaudo-wallet-${recaudoId}`,
    );
  }

  private async ensureVirtualAccounts(input: {
    customerId: string;
    recaudoId: string;
    walletAddress: string;
  }): Promise<TecnoVirtualAccount[]> {
    const opened: TecnoVirtualAccount[] = [];
    for (const currency of VA_CURRENCIES) {
      try {
        const account = await this.bridge.post<BridgeVirtualAccount>(
          `/v0/customers/${input.customerId}/virtual_accounts`,
          {
            source: { currency },
            destination: {
              payment_rail: WALLET_CHAIN,
              currency: 'usdc',
              address: input.walletAddress,
            },
          },
          `recaudo-va-${input.recaudoId}-${currency}`,
        );
        if (!account.id) continue;
        const rails =
          account.source_deposit_instructions?.payment_rails ??
          (account.source_deposit_instructions?.payment_rail
            ? [account.source_deposit_instructions.payment_rail]
            : []);
        opened.push({
          id: account.id,
          currency:
            account.source_deposit_instructions?.currency ?? currency,
          paymentRails: rails,
        });
      } catch (error) {
        this.logger.warn(
          `Virtual account ${currency} skipped: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      }
    }
    return opened;
  }
}
