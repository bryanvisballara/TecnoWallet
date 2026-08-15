import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BridgeErrorBody = {
  code?: string;
  message?: string;
  error?: string;
};

@Injectable()
export class BridgeClient {
  private readonly logger = new Logger(BridgeClient.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.apiKey());
  }

  get baseUrl(): string {
    const key = this.apiKey();
    if (key.startsWith('sk-test')) return 'https://api.sandbox.bridge.xyz';
    if (key.startsWith('sk-live')) return 'https://api.bridge.xyz';
    return (
      this.config.get<string>('BRIDGE_API_URL') ??
      'https://api.sandbox.bridge.xyz'
    ).replace(/\/+$/, '');
  }

  private apiKey() {
    return (this.config.get<string>('BRIDGE_API_KEY') ?? '')
      .trim()
      .replace(/^["']|["']$/g, '');
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'La verificación no está configurada todavía.',
      );
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Api-Key': apiKey,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
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
      this.logger.error(`Bridge network error ${method} ${path}`, error);
      throw new ServiceUnavailableException('Bridge API unreachable');
    }
    const text = await response.text();
    let json: unknown = {};
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        this.logger.warn(`Bridge non-JSON response ${response.status}`);
      }
    }
    if (!response.ok) {
      const err = json as BridgeErrorBody;
      const detail =
        err.message ?? err.error ?? err.code ?? `Bridge API error ${response.status}`;
      this.logger.warn(`Bridge ${method} ${path} → ${response.status}: ${detail}`);
      if (response.status === 401 || response.status === 403) {
        throw new ForbiddenException(
          'La clave de verificación no es válida para este entorno. En Render, BRIDGE_API_KEY debe ser sk-live si la URL es producción, o sk-test si es sandbox.',
        );
      }
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(detail);
      }
      throw new ServiceUnavailableException(detail);
    }
    return json as T;
  }

  async get<T = unknown>(path: string) {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(
    path: string,
    body: unknown,
    idempotencyKey?: string,
  ) {
    return this.request<T>('POST', path, body, idempotencyKey);
  }
}
