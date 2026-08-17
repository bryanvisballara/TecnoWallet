import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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

export type TecnoPaySession = {
  transferId: string;
  state: string;
  paid: boolean;
  amount: string;
  currency: string;
  startUrl?: string;
  creditMinor?: number;
  instructions?: TecnoDepositInstructions;
  viaVirtualAccount?: boolean;
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
  nextStep?: 'tos' | 'kyc' | 'wait' | 'done' | 'retry';
};

export type TecnoFiatPayoutConfig = {
  usd?: { wire?: string; ach?: string };
  eur?: { sepa?: string };
  brl?: { pix?: string };
  mxn?: { spei?: string };
};

export type TecnoExternalAccount = {
  id: string;
  currency: string;
  bankName?: string;
  accountOwnerName?: string;
  last4?: string;
  routingNumber?: string;
  accountType?: string;
  active: boolean;
};

export type TecnoOfframpSession = {
  transferId: string;
  state: string;
  amount: string;
  currency: string;
  rail: string;
};

export type CreateUsdExternalAccountInput = {
  bankName: string;
  accountOwnerName: string;
  firstName: string;
  lastName: string;
  routingNumber: string;
  accountNumber: string;
  checkingOrSavings: 'checking' | 'savings';
  streetLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type BridgeCustomer = {
  id?: string;
  email?: string;
  status?: string;
  first_name?: string;
  last_name?: string;
  endorsements?: Array<{ name?: string; status?: string }>;
  residential_address?: {
    street_line_1?: string;
    street_line_2?: string;
    city?: string;
    state?: string;
    subdivision?: string;
    postal_code?: string;
    country?: string;
  };
};

type BridgeExternalAccount = {
  id?: string;
  currency?: string;
  bank_name?: string;
  account_owner_name?: string;
  active?: boolean;
  account_type?: string;
  last_4?: string;
  account?: {
    last_4?: string;
    routing_number?: string;
    checking_or_savings?: string;
  };
};

type BridgeVaEvent = {
  id?: string;
  type?: string;
  amount?: string;
  currency?: string;
  receipt?: BridgeReceipt;
  destination?: { amount?: string; currency?: string };
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

type BridgeReceipt = {
  initial_amount?: string;
  final_amount?: string;
  subtotal_amount?: string;
};

type BridgeTransfer = {
  id?: string;
  state?: string;
  amount?: string;
  currency?: string;
  source_deposit_instructions?: BridgeDepositInstructions;
  destination?: {
    address?: string;
    to_address?: string;
    payment_rail?: string;
    currency?: string;
    amount?: string;
  };
  receipt?: BridgeReceipt;
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
const EXTRA_ENDORSEMENTS = ['cop', 'sepa', 'spei', 'pix'] as const;
const ONRAMP_RAIL: Record<(typeof VA_CURRENCIES)[number], string> = {
  usd: 'ach_push',
  cop: 'bre_b',
  mxn: 'spei',
  brl: 'pix',
  eur: 'sepa',
};
const TOS_RETURN_URL =
  'https://tecnowallet.onrender.com/api/v1/bridge/tos-return';
const KYC_RETURN_URL =
  'https://tecnowallet.onrender.com/api/v1/bridge/kyc-return';
const PAY_RETURN_URL =
  'https://tecnowallet.onrender.com/api/v1/bridge/pay-return';

const TRANSFER_PAID = new Set([
  'funds_received',
  'payment_submitted',
  'payment_processed',
  'completed',
  'settled',
]);

function withHostedRedirect(url: string | undefined, redirectUri: string) {
  const href = httpsUrl(url);
  if (!href) return undefined;
  try {
    const parsed = new URL(href);
    if (
      !parsed.searchParams.has('redirect_uri') &&
      !parsed.searchParams.has('redirect-uri')
    ) {
      parsed.searchParams.set(
        parsed.hostname.toLowerCase().includes('persona')
          ? 'redirect-uri'
          : 'redirect_uri',
        redirectUri,
      );
    }
    return parsed.toString();
  } catch {
    return href;
  }
}

function withTosRedirect(url?: string) {
  return withHostedRedirect(url, TOS_RETURN_URL);
}

function withKycRedirect(url?: string) {
  return withHostedRedirect(url, KYC_RETURN_URL);
}

function kycNextStep(snapshot: TecnoKycSnapshot): TecnoKycSnapshot['nextStep'] {
  if (snapshot.kycStatus === 'approved' && snapshot.tosStatus === 'approved') {
    return 'done';
  }
  if (snapshot.kycStatus === 'rejected' || snapshot.kycStatus === 'offboarded') {
    return 'retry';
  }
  if (snapshot.tosStatus !== 'approved') return 'tos';
  if (
    snapshot.kycStatus === 'under_review' ||
    snapshot.kycStatus === 'paused' ||
    snapshot.kycStatus === 'deposits_restricted'
  ) {
    return 'wait';
  }
  if (snapshot.kycUrl) return 'kyc';
  return 'wait';
}

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
  const tosStatus = link.tos_status;
  const snapshot: TecnoKycSnapshot = {
    customerId: link.customer_id,
    kycLinkId: link.id,
    kycStatus,
    tosStatus,
    kycUrl: withKycRedirect(link.kyc_link),
    tosUrl: withTosRedirect(link.tos_link),
    rejectionReasons: (link.rejection_reasons ?? [])
      .map((item) => item.reason?.trim())
      .filter((item): item is string => Boolean(item)),
    verified: kycStatus === 'approved' && tosStatus === 'approved',
  };
  snapshot.nextStep = kycNextStep(snapshot);
  return snapshot;
}

@Injectable()
export class RecaudoBridgeService {
  private readonly logger = new Logger(RecaudoBridgeService.name);
  private transferSettler?: (transferId: string) => Promise<unknown>;
  private readonly endorsementsEnsured = new Set<string>();

  constructor(private readonly bridge: BridgeClient) {}

  onTransferSettled(handler: (transferId: string) => Promise<unknown>) {
    this.transferSettler = handler;
  }

  async settleTransferWebhook(transferId: string) {
    if (!this.transferSettler) return;
    await this.transferSettler(transferId);
  }

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
    if (reusable && !input.retry) {
      if (reusable.customerId) await this.ensureEndorsements(reusable.customerId);
      return reusable;
    }

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
      const snapshot = await this.withFreshTosLink(mapKyc(link));
      if (snapshot.customerId) {
        await this.ensureEndorsements(snapshot.customerId);
      }
      return snapshot;
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
      const snapshot = await this.withFreshTosLink(mapKyc(link));
      if (snapshot.customerId) {
        await this.ensureEndorsements(snapshot.customerId);
      }
      return snapshot;
    }
  }

  async getKycLink(kycLinkId: string): Promise<TecnoKycSnapshot | undefined> {
    if (!this.bridge.configured || !kycLinkId.trim()) return undefined;
    try {
      const link = await this.bridge.get<BridgeKycLink>(
        `/v0/kyc_links/${kycLinkId.trim()}`,
      );
      const snapshot = await this.withFreshTosLink(mapKyc(link));
      if (snapshot.customerId) {
        await this.ensureEndorsements(snapshot.customerId);
      }
      return snapshot;
    } catch {
      return undefined;
    }
  }

  async ensureEndorsements(customerId: string) {
    const id = customerId.trim();
    if (!this.bridge.configured || !id || this.endorsementsEnsured.has(id)) {
      return;
    }
    let customer: BridgeCustomer | undefined;
    try {
      customer = await this.bridge.get<BridgeCustomer>(`/v0/customers/${id}`);
    } catch (error) {
      this.logger.warn(
        `Could not load customer ${id} for endorsements: ${
          error instanceof Error ? error.message : 'error'
        }`,
      );
      return;
    }
    const statusByName = new Map(
      (customer.endorsements ?? [])
        .map((item) => [
          item.name?.trim().toLowerCase() ?? '',
          item.status?.trim().toLowerCase() ?? '',
        ])
        .filter((item): item is [string, string] => Boolean(item[0])),
    );
    const missing = EXTRA_ENDORSEMENTS.filter((name) => {
      if (name === 'pix') {
        return !(
          statusByName.get('pix') === 'approved' ||
          statusByName.get('pix_onramp') === 'approved' ||
          statusByName.get('pix_offramp') === 'approved'
        );
      }
      return statusByName.get(name) !== 'approved';
    });
    if (missing.length === 0) {
      this.endorsementsEnsured.add(id);
      return;
    }
    const batch = missing
      .map((name) => `endorsement[]=${encodeURIComponent(name)}`)
      .join('&');
    try {
      await this.bridge.get(`/v0/customers/${id}/kyc_link?${batch}`);
      this.logger.log(
        `Requested endorsements ${missing.join(',')} for customer ${id}`,
      );
      return;
    } catch {
      this.logger.warn(
        `Batch endorsement request failed for ${id}; trying one by one`,
      );
    }
    for (const endorsement of missing) {
      try {
        await this.bridge.get(
          `/v0/customers/${id}/kyc_link?endorsement=${encodeURIComponent(endorsement)}`,
        );
      } catch (error) {
        this.logger.warn(
          `Endorsement ${endorsement} skipped for ${id}: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      }
    }
  }

  private async withFreshTosLink(snapshot: TecnoKycSnapshot) {
    if (snapshot.tosStatus === 'approved') {
      snapshot.nextStep = kycNextStep(snapshot);
      return snapshot;
    }
    const customerId = snapshot.customerId?.trim();
    if (customerId) {
      try {
        const row = await this.bridge.get<{ url?: string }>(
          `/v0/customers/${customerId}/tos_acceptance_link`,
        );
        snapshot.tosUrl = withTosRedirect(row.url) ?? snapshot.tosUrl;
      } catch {
        this.logger.warn(`ToS link missing for customer ${customerId}`);
      }
    }
    if (!snapshot.tosUrl) {
      try {
        const row = await this.bridge.post<{ url?: string }>(
          '/v0/customers/tos_links',
          {},
          `tos-${snapshot.kycLinkId ?? customerId ?? 'new'}`,
        );
        snapshot.tosUrl = withTosRedirect(row.url);
      } catch {
        this.logger.warn('Could not create a fresh ToS link');
      }
    }
    snapshot.nextStep = kycNextStep(snapshot);
    return snapshot;
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

  async peekWallet(
    customerId: string,
    walletId?: string,
  ): Promise<'missing' | 'unknown' | BridgeWallet> {
    const id = walletId?.trim();
    if (!this.bridge.configured || !customerId.trim() || !id) return 'missing';
    try {
      const current = await this.bridge.get<BridgeWallet>(
        `/v0/customers/${customerId}/wallets/${id}`,
      );
      if (current.id && current.address) return current;
      return 'missing';
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return 'unknown';
      this.logger.warn(`Wallet ${id} not on Bridge for ${customerId}`);
      return 'missing';
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
    preferredRail?: string;
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
      if (identity.customerId) {
        await this.ensureEndorsements(identity.customerId);
      }
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
        preferredRail: input.preferredRail,
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
      if (walletId) {
        try {
          const current = await this.bridge.get<BridgeWallet>(
            `/v0/customers/${customerId}/wallets/${walletId}`,
          );
          if (current.id && current.address) return current;
        } catch {
          // fall through
        }
      }
      throw error;
    }
  }

  private async ensureVirtualAccounts(input: {
    customerId: string;
    recaudoId: string;
    walletAddress: string;
    currencies: string[];
    preferredRail?: string;
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
      const mapped = mapVirtualAccount(row);
      if (mapped) byCurrency.set(mapped.currency.toLowerCase(), mapped);
    }

    for (const currency of input.currencies) {
      if (byCurrency.has(currency) && hasDepositDetails(byCurrency.get(currency))) {
        continue;
      }
      try {
        const account = await this.bridge.post<BridgeVirtualAccount>(
          `/v0/customers/${input.customerId}/virtual_accounts`,
          {
            developer_fee_percent: '0.0',
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
        if (mapped && hasDepositDetails(mapped)) {
          byCurrency.set(mapped.currency.toLowerCase(), mapped);
          continue;
        }
      } catch (error) {
        this.logger.warn(
          `Virtual account ${currency} skipped: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      }
      const transfer = await this.createOnrampTransfer({
        customerId: input.customerId,
        recaudoId: input.recaudoId,
        walletAddress: input.walletAddress,
        currency,
        rail:
          input.preferredRail ||
          ONRAMP_RAIL[currency as (typeof VA_CURRENCIES)[number]] ||
          'ach_push',
      });
      if (transfer) byCurrency.set(currency, transfer);
    }
    return [...byCurrency.values()];
  }

  private async createOnrampTransfer(input: {
    customerId: string;
    recaudoId: string;
    walletAddress: string;
    currency: string;
    rail: string;
  }): Promise<TecnoVirtualAccount | null> {
    try {
      const transfer = await this.bridge.post<BridgeTransfer>(
        '/v0/transfers',
        {
          developer_fee_percent: '0.0',
          on_behalf_of: input.customerId,
          source: {
            payment_rail: input.rail,
            currency: input.currency,
          },
          destination: {
            payment_rail: WALLET_CHAIN,
            currency: 'usdc',
            to_address: input.walletAddress,
          },
          features: { flexible_amount: true },
        },
        `recaudo-onramp-${input.recaudoId}-${input.currency}-${input.rail}`,
      );
      const mapped = mapVirtualAccount({
        id: transfer.id,
        destination: {
          address: input.walletAddress,
          payment_rail: WALLET_CHAIN,
          currency: 'usdc',
        },
        source_deposit_instructions: transfer.source_deposit_instructions,
      });
      if (!mapped) return null;
      return {
        ...mapped,
        currency: input.currency,
        paymentRails: mapped.paymentRails.length
          ? mapped.paymentRails
          : [input.rail],
      };
    } catch (error) {
      this.logger.warn(
        `Onramp ${input.currency}/${input.rail} failed: ${
          error instanceof Error ? error.message : 'error'
        }`,
      );
      return null;
    }
  }

  async createContributionTransfer(input: {
    customerId: string;
    recaudoId?: string;
    walletAddress: string;
    walletId?: string;
    currency: string;
    rail: string;
    amount: string;
    idempotencyKey: string;
  }): Promise<TecnoPaySession> {
    await this.ensureEndorsements(input.customerId);
    const currency = input.currency.trim().toLowerCase();
    const amount = formatPayAmount(currency, input.amount);
    const destinations = transferDestinations(
      currency,
      input.walletAddress,
      input.walletId,
    );
    let lastError: string | undefined;
    for (const [index, destination] of destinations.entries()) {
      try {
        const transfer = await this.bridge.post<BridgeTransfer>(
          '/v0/transfers',
          {
            developer_fee_percent: '0.0',
            amount,
            on_behalf_of: input.customerId,
            source: {
              payment_rail: input.rail,
              currency,
            },
            destination,
          },
          `${input.idempotencyKey}-t${index}`,
        );
        const session = mapPaySession(transfer);
        if (session.transferId) return session;
      } catch (error) {
        lastError = httpErrorDetail(error);
        this.logger.warn(
          `Pay transfer ${currency}/${input.rail} attempt ${index} failed: ${lastError}`,
        );
        if (isFatalPayError(error)) {
          throw new BadRequestException(userPayError(currency, lastError));
        }
      }
    }
    if (currency !== 'usd') {
      const viaAccount = await this.payViaVirtualAccount({
        customerId: input.customerId,
        recaudoId: input.recaudoId ?? 'pay',
        walletAddress: input.walletAddress,
        walletId: input.walletId,
        currency,
        amount,
      });
      if (viaAccount) return viaAccount;
    }
    throw new BadRequestException(
      userPayError(currency, lastError || 'No se pudo crear el pago.'),
    );
  }

  async getTransfer(
    transferId: string,
    customerId?: string,
  ): Promise<TecnoPaySession | undefined> {
    const id = transferId.trim();
    if (!this.bridge.configured || !id) return undefined;
    const transferLookup = id.startsWith('va:') ? id.split(':')[1] ?? '' : id;
    if (!id.startsWith('va:')) {
      try {
        const transfer = await this.bridge.get<BridgeTransfer>(
          `/v0/transfers/${id}`,
        );
        return mapPaySession(transfer);
      } catch {
        // May be a virtual account id from COP/EUR fallback.
      }
    }
    const owner = customerId?.trim();
    const accountId = transferLookup.trim();
    if (!owner || !accountId) return undefined;
    return this.getVirtualAccountSession(owner, accountId);
  }

  async getFiatPayoutConfiguration(
    customerId: string,
  ): Promise<TecnoFiatPayoutConfig> {
    const id = customerId.trim();
    if (!this.bridge.configured || !id) return {};
    try {
      const row = await this.bridge.get<{
        fiat_payout_configuration?: TecnoFiatPayoutConfig;
      }>(`/v0/customers/${id}/fiat_payout_configuration`);
      return row.fiat_payout_configuration ?? {};
    } catch (error) {
      this.logger.warn(
        `Fiat payout config failed for ${id}: ${httpErrorDetail(error)}`,
      );
      return {};
    }
  }

  async updateFiatPayoutConfiguration(
    customerId: string,
    patch: TecnoFiatPayoutConfig,
  ): Promise<TecnoFiatPayoutConfig> {
    const id = customerId.trim();
    if (!this.bridge.configured || !id) {
      throw new ServiceUnavailableException(
        'La verificación no está configurada todavía.',
      );
    }
    const row = await this.bridge.patch<{
      fiat_payout_configuration?: TecnoFiatPayoutConfig;
    }>(
      `/v0/customers/${id}/fiat_payout_configuration`,
      { fiat_payout_configuration: patch },
      `fiat-payout-${id}-${Date.now()}`,
    );
    return row.fiat_payout_configuration ?? patch;
  }

  async listExternalAccounts(
    customerId: string,
  ): Promise<TecnoExternalAccount[]> {
    const id = customerId.trim();
    if (!this.bridge.configured || !id) return [];
    try {
      const listed = await this.bridge.get<
        BridgeList<BridgeExternalAccount> | BridgeExternalAccount[]
      >(`/v0/customers/${id}/external_accounts`);
      const rows = Array.isArray(listed) ? listed : (listed.data ?? []);
      return rows
        .map(mapExternalAccount)
        .filter((item): item is TecnoExternalAccount => Boolean(item));
    } catch (error) {
      this.logger.warn(
        `List external accounts failed for ${id}: ${httpErrorDetail(error)}`,
      );
      return [];
    }
  }

  async createUsdExternalAccount(
    customerId: string,
    input: CreateUsdExternalAccountInput,
    idempotencyKey: string,
  ): Promise<TecnoExternalAccount> {
    const id = customerId.trim();
    if (!this.bridge.configured || !id) {
      throw new ServiceUnavailableException(
        'La verificación no está configurada todavía.',
      );
    }
    const customer = await this.bridge
      .get<BridgeCustomer>(`/v0/customers/${id}`)
      .catch(() => undefined);
    const address = customer?.residential_address;
    const street =
      input.streetLine1?.trim() || text(address?.street_line_1) || '';
    const city = input.city?.trim() || text(address?.city) || '';
    const state =
      input.state?.trim() ||
      text(address?.state) ||
      text(address?.subdivision) ||
      '';
    const postal =
      input.postalCode?.trim() || text(address?.postal_code) || '';
    const countryRaw = (
      input.country?.trim() ||
      text(address?.country) ||
      'USA'
    ).toUpperCase();
    const country =
      countryRaw === 'US' || countryRaw === 'USA' || countryRaw === 'UNITED STATES'
        ? 'USA'
        : countryRaw;
    if (!street || !city || !state || !postal) {
      throw new BadRequestException(
        'Falta la dirección del organizador para registrar la cuenta bancaria. Completa la verificación e inténtalo de nuevo.',
      );
    }
    const names = splitOwnerName(input.accountOwnerName);
    const account = await this.bridge.post<BridgeExternalAccount>(
      `/v0/customers/${id}/external_accounts`,
      {
        currency: 'usd',
        account_type: 'us',
        bank_name: input.bankName.trim(),
        account_name: `${input.bankName.trim()} account`,
        account_owner_type: 'individual',
        account_owner_name: input.accountOwnerName.trim(),
        first_name: input.firstName.trim() || names.firstName,
        last_name: input.lastName.trim() || names.lastName,
        account: {
          routing_number: input.routingNumber.replace(/\D/g, ''),
          account_number: input.accountNumber.replace(/\D/g, ''),
          checking_or_savings: input.checkingOrSavings,
        },
        address: {
          street_line_1: street,
          city,
          state,
          postal_code: postal,
          country,
        },
      },
      idempotencyKey,
    );
    const mapped = mapExternalAccount(account);
    if (!mapped) {
      throw new BadRequestException(
        'No se pudo registrar la cuenta bancaria. Revisa los datos e inténtalo de nuevo.',
      );
    }
    return mapped;
  }

  async createFiatOfframp(input: {
    customerId: string;
    walletId: string;
    externalAccountId: string;
    amountUsd: string;
    rail: 'ach' | 'wire';
    idempotencyKey: string;
  }): Promise<TecnoOfframpSession> {
    const customerId = input.customerId.trim();
    const walletId = input.walletId.trim();
    const externalAccountId = input.externalAccountId.trim();
    if (!this.bridge.configured || !customerId || !walletId || !externalAccountId) {
      throw new BadRequestException(
        'Abre la wallet digital y registra una cuenta bancaria antes de retirar.',
      );
    }
    const amount = formatPayAmount('usd', input.amountUsd);
    const rail = input.rail === 'wire' ? 'wire' : 'ach';
    if (rail === 'wire') {
      try {
        await this.updateFiatPayoutConfiguration(customerId, {
          usd: { wire: 'developer' },
        });
      } catch (error) {
        this.logger.warn(
          `Could not set wire payout identity: ${httpErrorDetail(error)}`,
        );
      }
    }
    try {
      const transfer = await this.bridge.post<BridgeTransfer>(
        '/v0/transfers',
        {
          developer_fee_percent: '0.0',
          amount,
          on_behalf_of: customerId,
          source: {
            payment_rail: 'bridge_wallet',
            currency: 'usdc',
            bridge_wallet_id: walletId,
          },
          destination: {
            currency: 'usd',
            payment_rail: rail,
            external_account_id: externalAccountId,
          },
        },
        input.idempotencyKey,
      );
      if (!transfer.id) {
        throw new BadRequestException(
          'No se pudo crear el retiro. Inténtalo de nuevo.',
        );
      }
      return {
        transferId: transfer.id,
        state: transfer.state || 'awaiting_funds',
        amount: transfer.amount || amount,
        currency: 'usd',
        rail,
      };
    } catch (error) {
      throw new BadRequestException(
        userWithdrawError(httpErrorDetail(error)),
      );
    }
  }

  private async payViaVirtualAccount(input: {
    customerId: string;
    recaudoId: string;
    walletAddress: string;
    walletId?: string;
    currency: string;
    amount: string;
  }): Promise<TecnoPaySession | undefined> {
    const listed = await this.bridge
      .get<BridgeList<BridgeVirtualAccount> | BridgeVirtualAccount[]>(
        `/v0/customers/${input.customerId}/virtual_accounts`,
      )
      .catch(() => ({ data: [] as BridgeVirtualAccount[] }));
    const existingRows = Array.isArray(listed) ? listed : (listed.data ?? []);
    const wantedAddress = input.walletAddress.trim().toLowerCase();
    for (const row of existingRows) {
      const dest = row.destination?.address?.trim().toLowerCase();
      if (dest && dest !== wantedAddress) continue;
      const mapped = mapVirtualAccount(row);
      if (!mapped || !hasDepositDetails(mapped)) continue;
      const currency = mapped.currency.toLowerCase() || input.currency;
      if (currency !== input.currency) continue;
      return sessionFromVirtualAccount(
        { ...mapped, currency },
        input.amount,
      );
    }
    const destinations = virtualAccountDestinations(
      input.walletAddress,
      input.walletId,
    );
    for (const [index, destination] of destinations.entries()) {
      try {
        const account = await this.bridge.post<BridgeVirtualAccount>(
          `/v0/customers/${input.customerId}/virtual_accounts`,
          {
            developer_fee_percent: '0.0',
            source: { currency: input.currency },
            destination,
          },
          `recaudo-va-${input.recaudoId}-${input.currency}-${index}`,
        );
        const mapped = mapVirtualAccount(account);
        if (mapped && hasDepositDetails(mapped)) {
          return sessionFromVirtualAccount(
            {
              ...mapped,
              currency: mapped.currency || input.currency,
            },
            input.amount,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Virtual account ${input.currency} attempt ${index} failed: ${httpErrorDetail(error)}`,
        );
        if (isFatalPayError(error)) break;
      }
    }
    return undefined;
  }

  private async getVirtualAccountSession(
    customerId: string,
    accountId: string,
  ): Promise<TecnoPaySession | undefined> {
    try {
      const account = await this.bridge.get<BridgeVirtualAccount>(
        `/v0/customers/${customerId}/virtual_accounts/${accountId}`,
      );
      const mapped = mapVirtualAccount(account);
      if (!mapped) return undefined;
      const session = sessionFromVirtualAccount(mapped, '');
      const history = await this.bridge
        .get<BridgeList<BridgeVaEvent> | BridgeVaEvent[]>(
          `/v0/customers/${customerId}/virtual_accounts/${accountId}/history`,
        )
        .catch(() => ({ data: [] as BridgeVaEvent[] }));
      const events = Array.isArray(history) ? history : (history.data ?? []);
      const paidEvent = events.find((event) => {
        const type = (event.type ?? '').toLowerCase();
        return TRANSFER_PAID.has(type) || type.includes('payment_processed');
      });
      if (!paidEvent) return session;
      const creditSource =
        paidEvent.destination?.amount ||
        paidEvent.receipt?.final_amount ||
        (paidEvent.currency?.toLowerCase() === 'usdc' ? paidEvent.amount : undefined);
      return {
        ...session,
        state: paidEvent.type || 'payment_processed',
        paid: true,
        amount: paidEvent.amount || session.amount,
        creditMinor: decimalToMinor(creditSource),
      };
    } catch {
      return undefined;
    }
  }
}

function hasDepositDetails(account?: TecnoVirtualAccount) {
  const info = account?.instructions;
  if (!info) return false;
  return Boolean(
    info.accountNumber ||
      info.iban ||
      info.clabe ||
      info.pixCode ||
      info.breBKey ||
      info.startUrl ||
      info.depositMessage,
  );
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
    startUrl: withHostedRedirect(
      text(raw?.start_url) ?? text(raw?.redirect_url),
      PAY_RETURN_URL,
    ),
  };
  return {
    id: account.id,
    currency,
    paymentRails: rails,
    instructions,
  };
}

function decimalToMinor(value?: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Math.max(1, Math.round(amount * 100));
}

function mapPaySession(transfer: BridgeTransfer): TecnoPaySession {
  const state = transfer.state || 'awaiting_funds';
  const destCurrency = transfer.destination?.currency?.toLowerCase();
  const creditSource =
    destCurrency === 'usdc' || destCurrency === 'usd'
      ? transfer.destination?.amount ||
        transfer.receipt?.final_amount ||
        transfer.amount
      : transfer.receipt?.final_amount || transfer.amount;
  const raw = transfer.source_deposit_instructions;
  const rails =
    raw?.payment_rails ?? (raw?.payment_rail ? [raw.payment_rail] : []);
  return {
    transferId: transfer.id || '',
    state,
    paid: TRANSFER_PAID.has(state),
    amount: transfer.amount || '',
    currency: (raw?.currency || transfer.currency || '').toLowerCase(),
    startUrl: withHostedRedirect(
      text(raw?.start_url) ?? text(raw?.redirect_url),
      PAY_RETURN_URL,
    ),
    creditMinor: decimalToMinor(creditSource),
    instructions: raw
      ? {
          currency: (raw.currency || '').toLowerCase(),
          paymentRails: rails,
          bankName: text(raw.bank_name),
          bankAddress: text(raw.bank_address),
          beneficiaryName: text(raw.bank_beneficiary_name),
          accountHolderName: text(raw.account_holder_name),
          accountNumber:
            text(raw.bank_account_number) ?? text(raw.account_number),
          routingNumber: text(raw.bank_routing_number),
          clabe: text(raw.clabe),
          iban: text(raw.iban),
          bic: text(raw.bic),
          pixCode: text(raw.br_code),
          breBKey: text(raw.bre_b_key),
          depositMessage: text(raw.deposit_message),
          startUrl: withHostedRedirect(
            text(raw.start_url) ?? text(raw.redirect_url),
            PAY_RETURN_URL,
          ),
        }
      : undefined,
  };
}

function sessionFromVirtualAccount(
  account: TecnoVirtualAccount,
  amount: string,
): TecnoPaySession {
  return {
    transferId: account.id,
    state: 'awaiting_funds',
    paid: false,
    amount,
    currency: account.currency,
    startUrl: account.instructions?.startUrl,
    instructions: account.instructions,
    viaVirtualAccount: true,
  };
}

function formatPayAmount(currency: string, raw: string) {
  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException('Escribe un monto mayor a cero.');
  }
  if (currency === 'cop' && amount < 100) {
    throw new BadRequestException('El mínimo para pesos es 100 COP.');
  }
  if (currency === 'cop') return String(Math.round(amount));
  return amount.toFixed(2);
}

function transferDestinations(
  currency: string,
  walletAddress: string,
  walletId?: string,
) {
  const address = walletAddress.trim();
  const id = walletId?.trim();
  const dests: Array<Record<string, string>> = [];
  if (currency === 'eur' && id) {
    dests.push({
      currency: 'usdc',
      payment_rail: WALLET_CHAIN,
      bridge_wallet_id: id,
    });
    dests.push({
      currency: 'usdc',
      payment_rail: WALLET_CHAIN,
      to_address: address,
      bridge_wallet_id: id,
    });
  }
  dests.push({
    currency: 'usdc',
    payment_rail: WALLET_CHAIN,
    to_address: address,
  });
  if (id && currency !== 'eur') {
    dests.push({
      currency: 'usdc',
      payment_rail: WALLET_CHAIN,
      to_address: address,
      bridge_wallet_id: id,
    });
  }
  return dests;
}

function virtualAccountDestinations(walletAddress: string, walletId?: string) {
  const address = walletAddress.trim();
  const id = walletId?.trim();
  const dests: Array<Record<string, string>> = [];
  dests.push({
    currency: 'usdc',
    payment_rail: WALLET_CHAIN,
    address,
  });
  if (id) {
    dests.push({
      currency: 'usdc',
      payment_rail: WALLET_CHAIN,
      address,
      bridge_wallet_id: id,
    });
    dests.push({
      currency: 'usdc',
      payment_rail: WALLET_CHAIN,
      bridge_wallet_id: id,
    });
  }
  return dests;
}

function httpErrorDetail(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string' && message.trim()) return message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'error';
}

function isFatalPayError(error: unknown) {
  if (!(error instanceof HttpException)) return false;
  const status = error.getStatus();
  if (status >= 500) return true;
  // Real auth failures only — Bridge also uses 401 for "not allowed" rails.
  return status === 401 && looksLikeCredentialFailure(httpErrorDetail(error));
}

function looksLikeCredentialFailure(detail: string) {
  return /invalid credentials|api[- ]key|unauthorized|authentication|not valid for this environment|invalid api/i.test(
    detail,
  );
}

function userPayError(currency: string, raw: string) {
  const text = raw.toLowerCase();
  if (/clave de verificación|sk-live|sk-test|api[- ]key/.test(text)) {
    return raw;
  }
  if (
    /contact.*enable sepa|enable sepa\/euro|sepa\/euro services|source\.currency:\s*not supported/.test(
      text,
    )
  ) {
    return 'Euros aún no están habilitados en la cuenta de cobros de TecnoWallet. Pide a la pasarela que active SEPA/Euro (Granted en el organizador no alcanza). Mientras tanto usa dólares.';
  }
  if (
    /'cop' endorsement required|create cop virtual|not authorized to create cop|enable.*cop/.test(
      text,
    )
  ) {
    return 'Pesos aún no están activos: el organizador tiene COP en Pending. Cuando pase a Granted podrás aportar en pesos. Mientras tanto usa dólares.';
  }
  if (
    /endorsement|not enabled|not available|forbidden|not permitted|not allowed|not granted|not_allowed/.test(
      text,
    )
  ) {
    if (currency === 'cop') {
      return 'Pesos aún no están activos en esta cuenta. Completa esa parte de la verificación e inténtalo de nuevo.';
    }
    if (currency === 'eur') {
      return 'Euros aún no están activos en esta cuenta. Completa esa parte de la verificación e inténtalo de nuevo.';
    }
    return 'Este medio de aporte aún no está activo. Completa la verificación e inténtalo de nuevo.';
  }
  if (/resubmit|missing or invalid|invalid_parameters/.test(text)) {
    if (currency === 'eur') {
      return 'No se pudo abrir el aporte en euros. Inténtalo de nuevo o usa dólares.';
    }
    if (currency === 'cop') {
      return 'No se pudo abrir el aporte en pesos. Inténtalo de nuevo o usa dólares.';
    }
    return 'No se pudo abrir este aporte. Revisa el monto e inténtalo de nuevo.';
  }
  return raw.replace(/\bBridge\b/gi, 'la pasarela').trim() || 'No se pudo crear el pago.';
}

function mapExternalAccount(
  account: BridgeExternalAccount,
): TecnoExternalAccount | null {
  if (!account.id) return null;
  return {
    id: account.id,
    currency: (account.currency || '').toLowerCase(),
    bankName: text(account.bank_name),
    accountOwnerName: text(account.account_owner_name),
    last4: text(account.last_4) ?? text(account.account?.last_4),
    routingNumber: text(account.account?.routing_number),
    accountType:
      text(account.account?.checking_or_savings) ?? text(account.account_type),
    active: account.active !== false,
  };
}

function splitOwnerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Account', lastName: 'Owner' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function userWithdrawError(raw: string) {
  const text = raw.toLowerCase();
  if (/insufficient|balance|not enough/.test(text)) {
    return 'No hay saldo suficiente en la wallet digital para este retiro.';
  }
  if (/external_account|routing|account_number|invalid/.test(text)) {
    return 'La cuenta bancaria no es válida. Revisa routing y número e inténtalo de nuevo.';
  }
  if (/endorsement|not enabled|not allowed|not_allowed|forbidden/.test(text)) {
    return 'Este medio de retiro aún no está activo. Usa ACH en dólares o inténtalo más tarde.';
  }
  return raw.replace(/\bBridge\b/gi, 'la pasarela').trim() || 'No se pudo crear el retiro.';
}
