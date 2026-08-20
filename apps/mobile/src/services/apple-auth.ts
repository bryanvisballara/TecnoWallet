import * as Crypto from 'expo-crypto';

import { createOauthNonce } from '@/services/google-auth';

export async function createAppleNonce() {
  const rawNonce = await createOauthNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, hashedNonce };
}
