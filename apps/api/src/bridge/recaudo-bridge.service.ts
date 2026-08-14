import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BridgeClient } from './bridge-client';

export type TecnoAccountStatus = 'pending_kyc' | 'ready' | 'failed';

export type TecnoDepositInstructions = {
  currency: string;
  paymentRails: string[];
  bankName?: string;
  bankAddress?: string;
  beneficiaryName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  routingNumber?: string;
  clabe?: string;
  iban?: string;
  bic?: string;
  pixCode?: string;
  breBKey?: string;
  depositMessage?: string;
};

export type TecnoVirtualAccount = {
  id: string;
  currency: string;
  paymentRails: string[];
  instructions?: TecnoDepositInstructions;
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

type BridgeDepositInstructions = {
  currency?: string;
  payment_rails?: string[];
  payment_rail?: string;
  bank_name?: string;
  bank_address?: string;
  bank_beneficiary_name?: string;
  bank_account_number?: string;
  bank_routing_number?: string;
  account_number?: string;
  clabe?: string;
  iban?: string;
  bic?: string;
  br_code?: string;
  bre_b_key?: string;
  deposit_message?: string;
  account_holder_name?: string;
};

type BridgeVirtualAccount = {
  id?: string;
  status?: string;
  source_deposit_instructions?: BridgeDepositInstructions;
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
    const listed = await this.bridge
      .get<BridgeList<BridgeVirtualAccount> | BridgeVirtualAccount[]>(
        `/v0/customers/${input.customerId}/virtual_accounts`,
      )
      .catch(() => ({ data: [] as BridgeVirtualAccount[] }));
    const existingRows = Array.isArray(listed) ? listed : (listed.data ?? []);
    const byCurrency = new Map<string, TecnoVirtualAccount>();
    for (const row of existingRows) {
      const mapped = mapVirtualAccount(row);
      if (mapped) byCurrency.set(mapped.currency.toLowerCase(), mapped);
    }

    for (const currency of VA_CURRENCIES) {
      if (byCurrency.has(currency)) continue;
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
        const mapped = mapVirtualAccount(account);
        if (mapped) byCurrency.set(mapped.currency.toLowerCase(), mapped);
      } catch (error) {
        this.logger.warn(
          `Virtual account ${currency} skipped: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      }
    }
    return [...byCurrency.values()];
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mapVirtualAccount(
  account: BridgeVirtualAccount,
): TecnoVirtualAccount | null {
  if (!account.id) return null;
  const raw = account.source_deposit_instructions;
  const rails =
    raw?.payment_rails ?? (raw?.payment_rail ? [raw.payment_rail] : []);
  const currency = (raw?.currency ?? '').toLowerCase();
  const instructions: TecnoDepositInstructions = {
    currency,
    paymentRails: rails,
    bankName: text(raw?.bank_name),
    bankAddress: text(raw?.bank_address),
    beneficiaryName: text(raw?.bank_beneficiary_name),
    accountHolderName: text(raw?.account_holder_name),
    accountNumber: text(raw?.bank_account_number) ?? text(raw?.account_number),
    routingNumber: text(raw?.bank_routing_number),
    clabe: text(raw?.clabe),
    iban: text(raw?.iban),
    bic: text(raw?.bic),
    pixCode: text(raw?.br_code),
    breBKey: text(raw?.bre_b_key),
    depositMessage: text(raw?.deposit_message),
  };
  return {
    id: account.id,
    currency,
    paymentRails: rails,
    instructions,
  };
}
