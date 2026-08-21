import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';

/** Public web origin used for Google HTTPS redirects (never custom schemes). */
export const APP_WEB_ORIGIN = (
  process.env.EXPO_PUBLIC_APP_WEB_URL?.trim() ||
    'https://tecnowallet.app'
).replace(/\/+$/, '');

export const NATIVE_OAUTH_RETURN = 'tecnowallet://oauthredirect';

/** Hostinger does not serve /oauth-google*. Render does. */
function oauthPageOrigin() {
  const api = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!api) return 'https://tecnowallet.onrender.com';
  try {
    return new URL(api).origin;
  } catch {
    return 'https://tecnowallet.onrender.com';
  }
}

function currentWebOrigin() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return '';
}

export function googleCallbackUrl() {
  return `${oauthPageOrigin()}/oauth-google-callback/`;
}

export function googleStartUrl(params?: { nonce?: string }) {
  const url = new URL(`${oauthPageOrigin()}/oauth-google.html`);
  if (params?.nonce) url.searchParams.set('nonce', params.nonce);
  if (Platform.OS !== 'web') url.searchParams.set('native', '1');
  const local = currentWebOrigin();
  if (local && !/onrender\.com$/i.test(local) && local !== APP_WEB_ORIGIN) {
    url.searchParams.set('return', `${local}/auth`);
  }
  return url.toString();
}

export function isGoogleReturnUrl(url: string) {
  return /tecnowallet:\/\/([^/?#]*\/)?oauthredirect(?:\?|#|$)/i.test(url);
}

export async function createOauthNonce() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build Google's authorize URL. Redirect URI must be HTTPS on the Web client. */
export function buildGoogleAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  nonce: string;
  state?: string;
}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'id_token');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('prompt', 'select_account');
  if (input.state) url.searchParams.set('state', input.state);
  return url.toString();
}

export function parseIdTokenFromUrl(rawUrl: string): string | null {
  try {
    const hashIndex = rawUrl.indexOf('#');
    const queryIndex = rawUrl.indexOf('?');
    const hash =
      hashIndex >= 0 ? rawUrl.slice(hashIndex + 1) : '';
    const query =
      queryIndex >= 0
        ? rawUrl.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
        : '';
    const params = new URLSearchParams(hash || query);
    const token = params.get('id_token')?.trim();
    return token || null;
  } catch {
    return null;
  }
}

export const WEB_ID_TOKEN_STORAGE_KEY = 'tw-google-id-token';
