import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type JsonApiResource = {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

type JsonApiDocument = {
  data?: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
  errors?: Array<{ title?: string; detail?: string; status?: string }>;
};

@Injectable()
export class UnitClient {
  private readonly logger = new Logger(UnitClient.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('UNIT_API_TOKEN'));
  }

  get baseUrl(): string {
    return (
      this.config.get<string>('UNIT_API_URL') ?? 'https://api.s.unit.sh'
    ).replace(/\/+$/, '');
  }

  async request<T = JsonApiDocument>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const token = this.config.get<string>('UNIT_API_TOKEN');
    if (!token) {
      throw new ServiceUnavailableException(
        'UNIT_API_TOKEN is not configured (sandbox only until set)',
      );
    }
    const headers: Record<string, string> = {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${token}`,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/vnd.api+json';
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.logger.error(`Unit network error ${method} ${path}`, error);
      throw new ServiceUnavailableException('Unit API unreachable');
    }
    const text = await response.text();
    let json: JsonApiDocument = {};
    if (text) {
      try {
        json = JSON.parse(text) as JsonApiDocument;
      } catch {
        this.logger.warn(`Unit non-JSON response ${response.status}`);
      }
    }
    if (!response.ok) {
      const detail =
        json.errors?.[0]?.detail ??
        json.errors?.[0]?.title ??
        `Unit API error ${response.status}`;
      this.logger.warn(`Unit ${method} ${path} → ${response.status}: ${detail}`);
      throw new ServiceUnavailableException(detail);
    }
    return json as T;
  }

  async post<T = JsonApiDocument>(
    path: string,
    body: unknown,
    idempotencyKey?: string,
  ) {
    return this.request<T>('POST', path, body, idempotencyKey);
  }

  async get<T = JsonApiDocument>(path: string) {
    return this.request<T>('GET', path);
  }

  async patch<T = JsonApiDocument>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  single(doc: JsonApiDocument): JsonApiResource {
    if (!doc.data || Array.isArray(doc.data)) {
      throw new ServiceUnavailableException('Unexpected Unit response shape');
    }
    return doc.data;
  }
}
