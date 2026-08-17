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
  source?: unknown;
};

const API_KEY_HINT =
  'La clave de verificación no es válida para este entorno. En Render, BRIDGE_API_KEY debe ser sk-live si la URL es producción, o sk-test si es sandbox.';

function sourceHint(source: unknown): string | undefined {
  if (!source) return undefined;
  if (typeof source === 'string' && source.trim()) return source.trim();
  if (typeof source !== 'object') return undefined;
  const rec = source as Record<string, unknown>;
  if (typeof rec.key === 'string' && rec.key.trim()) return rec.key.trim();
  if (rec.key && typeof rec.key === 'object') {
    try {
      const parts = Object.entries(rec.key as Record<string, unknown>).map(
        ([field, reason]) => `${field}: ${String(reason)}`,
      );
      const packed = parts.join('; ');
      return packed ? packed.slice(0, 240) : undefined;
    } catch {
      // fall through
    }
  }
  try {
    const packed = JSON.stringify(rec.key ?? rec);
    return packed && packed !== '{}' ? packed.slice(0, 180) : undefined;
  } catch {
    return undefined;
  }
}

function looksLikeApiKeyError(_status: number, detail: string) {
  if (
    /not_allowed|not authorized|endorsement|enable .*services|contact bridge|not supported/i.test(
      detail,
    )
  ) {
    return false;
  }
  return /invalid credentials|api[- ]key|unauthorized|authentication|not valid for this environment|invalid api/i.test(
    detail,
  );
}

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
    let raw = (this.config.get<string>('BRIDGE_API_KEY') ?? '')
      .trim()
      .replace(/^["']|["']$/g, '');
    raw = raw.replace(/^BRIDGE_API_KEY\s*=\s*/i, '').trim();
    return raw;
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
      const hint = sourceHint(err.source);
      const detail = [err.message ?? err.error ?? err.code, hint]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' — ') || `Error ${response.status}`;
      this.logger.warn(`Bridge ${method} ${path} → ${response.status}: ${detail}`);
      if (looksLikeApiKeyError(response.status, detail)) {
        throw new ForbiddenException(API_KEY_HINT);
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

  async patch<T = unknown>(
    path: string,
    body: unknown,
    idempotencyKey?: string,
  ) {
    return this.request<T>('PATCH', path, body, idempotencyKey);
  }
}
