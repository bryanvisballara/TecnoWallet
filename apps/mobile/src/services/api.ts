import { offlineQueue, tokenStorage, type OfflineMutation } from './persistence';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError('API no configurada; usando datos de demostración.', 503);
  const token = await tokenStorage.get();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new ApiError('No pudimos completar la solicitud.', response.status);
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
