import {
  offlineQueue,
  refreshTokenStorage,
  tokenStorage,
  type OfflineMutation,
} from './persistence';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

async function errorFromResponse(response: Response) {
  const fallback = 'No pudimos completar la solicitud.';
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      code?: string;
    };
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message || fallback;
    return new ApiError(message, response.status, body.code);
  } catch {
    return new ApiError(fallback, response.status);
  }
}

async function refreshAccessToken() {
  if (!API_URL) return false;
  const refreshToken = await refreshTokenStorage.get();
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    await Promise.all([tokenStorage.clear(), refreshTokenStorage.clear()]);
    return false;
  }
  const auth = (await response.json()) as AuthResponse;
  await Promise.all([
    tokenStorage.set(auth.accessToken),
    refreshTokenStorage.set(auth.refreshToken),
  ]);
  return true;
}

async function performRequest(path: string, init: RequestInit) {
  const token = await tokenStorage.get();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!API_URL) throw new ApiError('API no configurada; usando datos de demostración.', 503);
  let response = await performRequest(path, init);
  if (
    response.status === 401 &&
    !path.startsWith('/auth/') &&
    (await refreshAccessToken())
  ) {
    response = await performRequest(path, init);
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function mutateOffline<T>(
  mutation: Omit<OfflineMutation, 'id' | 'idempotencyKey' | 'createdAt' | 'attempts'>,
): Promise<{ queued: boolean; data?: T }> {
  const idempotencyKey =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const data = await apiRequest<T>(mutation.endpoint, {
      method: mutation.method,
      body: mutation.payload ? JSON.stringify(mutation.payload) : undefined,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return { queued: false, data };
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) throw error;
    await offlineQueue.enqueue({ ...mutation, idempotencyKey });
    return { queued: true };
  }
}

export async function flushOfflineQueue() {
  const queue = await offlineQueue.list();
  const remaining: OfflineMutation[] = [];
  for (const mutation of queue) {
    try {
      await apiRequest(mutation.endpoint, {
        method: mutation.method,
        body: mutation.payload ? JSON.stringify(mutation.payload) : undefined,
        headers: {
          'Idempotency-Key': mutation.idempotencyKey,
          ...(mutation.baseVersion !== undefined
            ? { 'If-Match': String(mutation.baseVersion) }
            : {}),
        },
      });
    } catch {
      remaining.push({ ...mutation, attempts: mutation.attempts + 1 });
    }
  }
  await offlineQueue.replace(remaining);
  return { synced: queue.length - remaining.length, remaining: remaining.length };
}
