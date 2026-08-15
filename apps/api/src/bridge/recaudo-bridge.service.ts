import { Injectable, Logger } from '@nestjs/common';
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
  startUrl?: string;
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
  kycLinkId?: string;
  kycStatus?: string;
  tosStatus?: string;
  status: TecnoAccountStatus;
  virtualAccounts: TecnoVirtualAccount[];
  error?: string;
};

export type TecnoKycSnapshot = {
  customerId?: string;
  kycLinkId?: string;
  kycStatus: string;
  tosStatus?: string;
  kycUrl?: string;
  tosUrl?: string;
  rejectionReasons: string[];
  verified: boolean;
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
  id?: string;
  customer_id?: string;
  kyc_link?: string;
  tos_link?: string;
  kyc_status?: string;
  tos_status?: string;
  rejection_reasons?: Array<{ reason?: string }>;
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
  start_url?: string;
  redirect_url?: string;
};

type BridgeVirtualAccount = {
  id?: string;
  status?: string;
  destination?: { address?: string; payment_rail?: string; currency?: string };
  source_deposit_instructions?: BridgeDepositInstructions;
};

const VA_CURRENCIES = ['usd', 'cop', 'mxn', 'brl', 'eur'] as const;
const WALLET_CHAIN = 'base';
const KYC_ENDORSEMENTS = ['base', 'cop', 'sepa', 'spei', 'pix'] as const;

function httpsUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) return `https://${raw.slice('http://'.length)}`;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`;
  return undefined;
}

function mapKyc(link: BridgeKycLink): TecnoKycSnapshot {
  const kycStatus = link.kyc_status || 'not_started';
  return {
    customerId: link.customer_id,
    kycLinkId: link.id,
    kycStatus,
    tosStatus: link.tos_status,
    kycUrl: httpsUrl(link.kyc_link),
    tosUrl: httpsUrl(link.tos_link),
    rejectionReasons: (link.rejection_reasons ?? [])
      .map((item) => item.reason?.trim())
      .filter((item): item is string => Boolean(item)),
    verified: kycStatus === 'approved',
  };
}

@Injectable()
export class RecaudoBridgeService {
  private readonly logger = new Logger(RecaudoBridgeService.name);

  constructor(private readonly bridge: BridgeClient) {}

  async createKycLink(input: {
    email: string;
    fullName: string;
    existingLinkId?: string;
    retry?: boolean;
  }): Promise<TecnoKycSnapshot> {
    if (!this.bridge.configured) {
      throw new Error('not_configured');
    }
    if (input.existingLinkId && !input.retry) {
      const current = await this.getKycLink(input.existingLinkId);
      if (
        current &&
        current.kycStatus !== 'rejected' &&
        current.kycStatus !== 'offboarded'
      ) {
        return current;
      }
    }

    const listed = await this.listKycLinks(input.email);
    const reusable = listed.find((item) => item.verified);
    if (reusable && !input.retry) return reusable;

    const body = {
      full_name: input.fullName,
      email: input.email,
      type: 'individual' as const,
      endorsements: [...KYC_ENDORSEMENTS],
    };
    const idempotency = input.retry
      ? `kyc-${input.email.toLowerCase()}-${Date.now()}`
      : `kyc-${input.email.toLowerCase()}`;
    try {
      const link = await this.bridge.post<BridgeKycLink>(
        '/v0/kyc_links',
        body,
        idempotency,
      );
      return mapKyc(link);
    } catch {
      const link = await this.bridge.post<BridgeKycLink>(
        '/v0/kyc_links',
        {
          full_name: input.fullName,
          email: input.email,
          type: 'individual',
        },
        `${idempotency}-basic`,
      );
      return mapKyc(link);
    }
  }

  async getKycLink(kycLinkId: string): Promise<TecnoKycSnapshot | undefined> {
    if (!this.bridge.configured || !kycLinkId.trim()) return undefined;
    try {
      const link = await this.bridge.get<BridgeKycLink>(
        `/v0/kyc_links/${kycLinkId.trim()}`,
      );
      return mapKyc(link);
    } catch {
      return undefined;
    }
  }

  async listKycLinks(email: string): Promise<TecnoKycSnapshot[]> {
    if (!this.bridge.configured) return [];
    try {
      const listed = await this.bridge.get<BridgeList<BridgeKycLink>>(
        `/v0/kyc_links?email=${encodeURIComponent(email.toLowerCase())}&limit=20`,
      );
      return (listed.data ?? []).map(mapKyc);
    } catch {
      return [];
    }
  }

  async provision(input: {
    recaudoId: string;
    organizerEmail: string;
    organizerName: string;
    existingCustomerId?: string;
    /** Only these fiat rails. Empty = wallet only (crypto). Never open every VA. */
    currencies?: string[];
    existingWalletId?: string;
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
          kycLinkId: identity.kycLinkId,
          kycStatus: identity.kycStatus,
          virtualAccounts: [],
        };
      }

      const wallet = await this.ensureWallet(
        identity.customerId,
        input.recaudoId,
        input.existingWalletId,
      );
      if (!wallet.address || !wallet.id) {
        return {
          customerId: identity.customerId,
          status: identity.kycUrl ? 'pending_kyc' : 'failed',
          kycUrl: identity.kycUrl,
          tosUrl: identity.tosUrl,
          kycLinkId: identity.kycLinkId,
          kycStatus: identity.kycStatus,
          virtualAccounts: [],
          error: 'wallet',
        };
      }

      const wanted = (input.currencies ?? [])
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is (typeof VA_CURRENCIES)[number] =>
          (VA_CURRENCIES as readonly string[]).includes(item),
        );
      const virtualAccounts = await this.ensureVirtualAccounts({
        customerId: identity.customerId,
        recaudoId: input.recaudoId,
        walletAddress: wallet.address,
        currencies: wanted,
      });

      return {
        customerId: identity.customerId,
        walletId: wallet.id,
        walletAddress: wallet.address,
        chain: wallet.chain ?? WALLET_CHAIN,
        kycUrl: identity.kycUrl,
        tosUrl: identity.tosUrl,
        kycLinkId: identity.kycLinkId,
        kycStatus: identity.kycStatus,
        status: 'ready',
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
    kycLinkId?: string;
    kycStatus?: string;
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

    const link = await this.createKycLink({ email, fullName: name });
    return {
      customerId: link.customerId,
      kycUrl: link.kycUrl,
      tosUrl: link.tosUrl,
      kycLinkId: link.kycLinkId,
      kycStatus: link.kycStatus,
    };
  }

  private async ensureWallet(
    customerId: string,
    recaudoId: string,
    existingWalletId?: string,
  ) {
    const walletId = existingWalletId?.trim();
    if (walletId) {
      try {
        const current = await this.bridge.get<BridgeWallet>(
          `/v0/customers/${customerId}/wallets/${walletId}`,
        );
        if (current.id && current.address) return current;
      } catch {
        this.logger.warn(`Stored wallet ${walletId} missing; creating another`);
      }
    }

    try {
      return await this.bridge.post<BridgeWallet>(
        `/v0/customers/${customerId}/wallets`,
        { chain: WALLET_CHAIN },
        `recaudo-wallet-${recaudoId}`,
      );
    } catch (error) {
      const listed = await this.bridge
        .get<BridgeList<BridgeWallet> | BridgeWallet[]>(
          `/v0/customers/${customerId}/wallets`,
        )
        .catch(() => ({ data: [] as BridgeWallet[] }));
      const rows = Array.isArray(listed) ? listed : (listed.data ?? []);
      const existing = rows.find((row) => row.id && row.address);
      if (existing) return existing;
      throw error;
    }
  }

  private async ensureVirtualAccounts(input: {
    customerId: string;
    recaudoId: string;
    walletAddress: string;
    currencies: string[];
  }): Promise<TecnoVirtualAccount[]> {
    const listed = await this.bridge
      .get<BridgeList<BridgeVirtualAccount> | BridgeVirtualAccount[]>(
        `/v0/customers/${input.customerId}/virtual_accounts`,
      )
      .catch(() => ({ data: [] as BridgeVirtualAccount[] }));
    const existingRows = Array.isArray(listed) ? listed : (listed.data ?? []);
    const wantedAddress = input.walletAddress.trim().toLowerCase();
    const byCurrency = new Map<string, TecnoVirtualAccount>();
    for (const row of existingRows) {
      const dest = row.destination?.address?.trim().toLowerCase();
      if (dest && dest !== wantedAddress) continue;
      if (!dest) continue;
      const mapped = mapVirtualAccount(row);
      if (mapped) byCurrency.set(mapped.currency.toLowerCase(), mapped);
    }

    for (const currency of input.currencies) {
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
    startUrl: httpsUrl(text(raw?.start_url) ?? text(raw?.redirect_url)),
  };
  return {
    id: account.id,
    currency,
    paymentRails: rails,
    instructions,
  };
}
