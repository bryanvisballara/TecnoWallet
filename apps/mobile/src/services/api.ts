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

let refreshInFlight: Promise<boolean> | null = null;
let sessionExpiredHandler: (() => void) | null = null;
/** Bumped on login/logout so a stale 401 cannot wipe a newer session. */
let authEpoch = 0;

/** Auth store registers this so a hard 401 clears UI session (not only tokens). */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

/** Call whenever local tokens are replaced or cleared (login / logout / expiry). */
export function bumpAuthEpoch() {
  authEpoch += 1;
  return authEpoch;
}

function emitSessionExpired() {
  try {
    sessionExpiredHandler?.();
  } catch {
    // Never block the request path on listener errors.
  }
}

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
  if (refreshInFlight) return refreshInFlight;
  const epochAtStart = authEpoch;
  refreshInFlight = (async () => {
    const refreshToken = await refreshTokenStorage.get();
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      // A newer login/logout won — leave its tokens alone.
      if (epochAtStart !== authEpoch) return false;
      if (response.status === 401 || response.status === 403) {
        await Promise.all([tokenStorage.clear(), refreshTokenStorage.clear()]);
        if (epochAtStart === authEpoch) bumpAuthEpoch();
        return false;
      }
      if (!response.ok) {
        // Keep local session on transient/server errors.
        return false;
      }
      const auth = (await response.json()) as AuthResponse;
      if (epochAtStart !== authEpoch) return false;
      await Promise.all([
        tokenStorage.set(auth.accessToken),
        refreshTokenStorage.set(auth.refreshToken),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Renew tokens if a refresh session exists (keeps login persistent across app restarts). */
export async function ensureAuthSession() {
  const refreshToken = await refreshTokenStorage.get();
  if (!refreshToken) return false;
  return refreshAccessToken();
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
  if (!API_URL)
    throw new ApiError('API no configurada; usando datos de demostración.', 503);

  const epochAtStart = authEpoch;
  const [accessAtStart, refreshAtStart] = await Promise.all([
    tokenStorage.get(),
    refreshTokenStorage.get(),
  ]);
  const hadSession = Boolean(accessAtStart || refreshAtStart);

  let response = await performRequest(path, init);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    // Unauthenticated probes must not clear a login that started mid-flight.
    if (!hadSession) {
      throw await errorFromResponse(response);
    }

    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await performRequest(path, init);
    } else if (epochAtStart === authEpoch) {
      // Refresh failed for this same session — drop it so UI can leave tabs.
      await Promise.all([tokenStorage.clear(), refreshTokenStorage.clear()]);
      bumpAuthEpoch();
      emitSessionExpired();
      throw await errorFromResponse(response);
    } else {
      // A newer login/logout happened while this request was in flight.
      throw await errorFromResponse(response);
    }
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function mutateOffline<T>(
  mutation: Omit<
    OfflineMutation,
    'id' | 'idempotencyKey' | 'createdAt' | 'attempts'
  >,
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
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408
    ) {
      throw error;
    }
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
