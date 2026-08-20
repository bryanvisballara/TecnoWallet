import { generateKeyPairSync } from 'node:crypto';
import { sign } from 'jsonwebtoken';

import {
  resetAppleJwksCache,
  sha256Hex,
  verifyAppleIdentityToken,
} from './apple-identity';

function signAppleToken(input: {
  privateKey: string;
  kid: string;
  payload: Record<string, unknown>;
  audience?: string;
}) {
  return sign(input.payload, input.privateKey, {
    algorithm: 'RS256',
    keyid: input.kid,
    issuer: 'https://appleid.apple.com',
    audience: input.audience ?? 'com.tecnowallet.mobile',
    expiresIn: '5m',
  });
}

describe('verifyAppleIdentityToken', () => {
  const kid = 'test-kid';
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const fetchJwks: typeof fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }],
      }),
    }) as Response;

  beforeEach(() => {
    resetAppleJwksCache();
  });

  it('accepts a valid Apple identity token and hashed nonce', async () => {
    const rawNonce = 'abc123nonce';
    const token = signAppleToken({
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      kid,
      payload: {
        sub: '001234.appleuser.5678',
        email: 'hidden@privaterelay.appleid.com',
        email_verified: 'true',
        is_private_email: 'true',
        nonce: sha256Hex(rawNonce),
      },
    });

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ['com.tecnowallet.mobile'],
        rawNonce,
        fetchJwks,
      }),
    ).resolves.toEqual({
      appleId: '001234.appleuser.5678',
      email: 'hidden@privaterelay.appleid.com',
      emailVerified: true,
      isPrivateEmail: true,
    });
  });

  it('rejects a token issued for another bundle id', async () => {
    const token = signAppleToken({
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      kid,
      audience: 'com.other.app',
      payload: { sub: '001234.appleuser.5678' },
    });

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ['com.tecnowallet.mobile'],
        fetchJwks,
      }),
    ).rejects.toThrow('Invalid Apple identity token');
  });

  it('rejects a nonce that does not match the token', async () => {
    const token = signAppleToken({
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      kid,
      payload: {
        sub: '001234.appleuser.5678',
        nonce: sha256Hex('expected-nonce'),
      },
    });

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ['com.tecnowallet.mobile'],
        rawNonce: 'other-nonce',
        fetchJwks,
      }),
    ).rejects.toThrow('Invalid Apple nonce');
  });
});
