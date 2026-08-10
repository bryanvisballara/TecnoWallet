import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BelvoListResponse<T> = {
  count?: number;
  next?: string | null;
  results?: T[];
};

export type BelvoLink = {
  id: string;
  institution: string;
  status?: string;
  access_mode?: string;
  created_at?: string;
};

export type BelvoAccount = {
  id: string;
  link: string;
  name?: string;
  number?: string;
  category?: string;
  balance?: { available?: number; current?: number };
  currency?: string;
  institution?: { name?: string };
};

export type BelvoTransaction = {
  id: string;
  account: string;
  link?: string;
  description?: string;
  amount: number;
  currency?: string;
  type?: string;
  status?: string;
  value_date?: string;
  accounting_date?: string;
  merchant?: { name?: string };
  category?: string;
};

@Injectable()
export class BelvoClient {
  private readonly logger = new Logger(BelvoClient.name);

  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(
      this.config.get<string>('BELVO_SECRET_ID')?.trim() &&
        this.config.get<string>('BELVO_SECRET_PASSWORD')?.trim(),
    );
  }

  private baseUrl() {
    return (
      this.config.get<string>('BELVO_API_URL')?.replace(/\/$/, '') ||
      'https://sandbox.belvo.com'
    );
  }

  private authHeader() {
    const id = this.config.get<string>('BELVO_SECRET_ID')?.trim() ?? '';
    const password =
      this.config.get<string>('BELVO_SECRET_PASSWORD')?.trim() ?? '';
    if (!id || !password) {
      throw new ServiceUnavailableException('Belvo is not configured');
    }
    const token = Buffer.from(`${id}:${password}`).toString('base64');
    return `Basic ${token}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: this.authHeader(),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      this.logger.warn(`Belvo ${path} → ${response.status}: ${text.slice(0, 300)}`);
      const message =
        Array.isArray(body) && body[0] && typeof body[0] === 'object'
          ? String((body[0] as { message?: string }).message ?? 'Belvo error')
          : typeof body === 'object' &&
              body &&
              'message' in body &&
              typeof (body as { message?: unknown }).message === 'string'
            ? (body as { message: string }).message
            : `Belvo request failed (${response.status})`;
      throw new ServiceUnavailableException(message);
    }
    return body as T;
  }

  async createWidgetToken() {
    const id = this.config.get<string>('BELVO_SECRET_ID')?.trim() ?? '';
    const password =
      this.config.get<string>('BELVO_SECRET_PASSWORD')?.trim() ?? '';
    if (!id || !password) {
      throw new ServiceUnavailableException('Belvo is not configured');
    }
    const response = await fetch(`${this.baseUrl()}/api/token/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        password,
        scopes: 'read_institutions,write_links',
        fetch_resources: ['ACCOUNTS', 'TRANSACTIONS', 'OWNERS'],
        credentials_storage: '30d',
        stale_in: '365d',
      }),
    });
    const body = (await response.json()) as {
      access?: string;
      refresh?: string;
      message?: string;
    };
    if (!response.ok || !body.access) {
      throw new ServiceUnavailableException(
        body.message || 'Could not create Belvo widget token',
      );
    }
    return { access: body.access, refresh: body.refresh };
  }

  async getLink(linkId: string) {
    return this.request<BelvoLink>(`/api/links/${linkId}/`);
  }

  async listAccounts(linkId: string) {
    const data = await this.request<BelvoListResponse<BelvoAccount> | BelvoAccount[]>(
      `/api/accounts/?link=${encodeURIComponent(linkId)}&page_size=100`,
    );
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  async listTransactions(input: {
    linkId: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const params = new URLSearchParams({
      link: input.linkId,
      page_size: '100',
    });
    if (input.dateFrom) params.set('value_date__gte', input.dateFrom);
    if (input.dateTo) params.set('value_date__lte', input.dateTo);
    const data = await this.request<
      BelvoListResponse<BelvoTransaction> | BelvoTransaction[]
    >(`/api/transactions/?${params.toString()}`);
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  /** Forces a fresh retrieve for recurrent/single links when supported. */
  async retrieveTransactions(linkId: string, dateFrom: string, dateTo: string) {
    try {
      return await this.request<BelvoTransaction[]>('/api/transactions/', {
        method: 'POST',
        body: JSON.stringify({
          link: linkId,
          date_from: dateFrom,
          date_to: dateTo,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Belvo retrieve transactions failed, falling back to list: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return this.listTransactions({ linkId, dateFrom, dateTo });
    }
  }
}
