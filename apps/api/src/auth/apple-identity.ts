import { createHash, createPublicKey } from 'node:crypto';
import { verify } from 'jsonwebtoken';

const APPLE_ISS = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_TTL_MS = 60 * 60 * 1000;

type AppleJwk = {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
};

type AppleJwtPayload = {
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  sub: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
};

export type AppleIdentity = {
  appleId: string;
  email?: string;
  emailVerified: boolean;
  isPrivateEmail: boolean;
};

let cachedJwks: { expiresAt: number; keys: AppleJwk[] } | null = null;

export function resetAppleJwksCache() {
  cachedJwks = null;
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isTruthyFlag(value: unknown) {
  return value === true || value === 'true';
}

async function loadAppleJwks(
  fetchImpl: typeof fetch = fetch,
): Promise<AppleJwk[]> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) {
    return cachedJwks.keys;
  }
  const response = await fetchImpl(APPLE_JWKS_URL);
  if (!response.ok) {
    throw new Error('Apple JWKS unavailable');
  }
  const body = (await response.json()) as { keys?: AppleJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) {
    throw new Error('Apple JWKS empty');
  }
  cachedJwks = { keys, expiresAt: Date.now() + JWKS_TTL_MS };
  return keys;
}

export async function verifyAppleIdentityToken(input: {
  identityToken: string;
  audiences: string[];
  rawNonce?: string;
  fetchJwks?: typeof fetch;
}): Promise<AppleIdentity> {
  const token = input.identityToken.trim();
  if (!token || !input.audiences.length) {
    throw new Error('Apple identity token is not configured');
  }

  const headerJson = token.split('.')[0];
  if (!headerJson) {
    throw new Error('Invalid Apple identity token');
  }
  let kid = '';
  try {
    const header = JSON.parse(
      Buffer.from(headerJson, 'base64url').toString('utf8'),
    ) as { kid?: string; alg?: string };
    kid = header.kid?.trim() ?? '';
    if (header.alg && header.alg !== 'RS256') {
      throw new Error('Unsupported Apple token algorithm');
    }
  } catch {
    throw new Error('Invalid Apple identity token');
  }
  if (!kid) {
    throw new Error('Invalid Apple identity token');
  }

  const keys = await loadAppleJwks(input.fetchJwks);
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) {
    cachedJwks = null;
    const retry = await loadAppleJwks(input.fetchJwks);
    const refreshed = retry.find((key) => key.kid === kid);
    if (!refreshed) {
      throw new Error('Apple signing key not found');
    }
    return verifyWithJwk(token, refreshed, input);
  }
  return verifyWithJwk(token, jwk, input);
}

function verifyWithJwk(
  token: string,
  jwk: AppleJwk,
  input: {
    audiences: string[];
    rawNonce?: string;
  },
): AppleIdentity {
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  let payload: AppleJwtPayload;
  try {
    payload = verify(token, key, {
      algorithms: ['RS256'],
      issuer: APPLE_ISS,
    }) as AppleJwtPayload;
  } catch {
    throw new Error('Invalid Apple identity token');
  }

  const tokenAudiences = Array.isArray(payload.aud)
    ? payload.aud
    : [payload.aud];
  if (!input.audiences.some((audience) => tokenAudiences.includes(audience))) {
    throw new Error('Invalid Apple identity token');
  }

  const appleId = payload.sub?.trim();
  if (!appleId) {
    throw new Error('Invalid Apple identity token');
  }

  const rawNonce = input.rawNonce?.trim();
  if (rawNonce && payload.nonce) {
    const hashed = sha256Hex(rawNonce);
    if (payload.nonce !== hashed && payload.nonce !== rawNonce) {
      throw new Error('Invalid Apple nonce');
    }
  }

  const email = payload.email?.trim().toLowerCase();
  return {
    appleId,
    email: email || undefined,
    emailVerified: isTruthyFlag(payload.email_verified) || Boolean(email),
    isPrivateEmail: isTruthyFlag(payload.is_private_email),
  };
}
