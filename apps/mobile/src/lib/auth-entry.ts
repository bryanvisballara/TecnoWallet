export type AuthEntryMode = 'login' | 'register';

export function authHref(mode: AuthEntryMode, affiliateCode?: string) {
  const params: { mode: AuthEntryMode; affiliate?: string } = { mode };
  const code = affiliateCode?.trim().toUpperCase();
  if (code && code.length >= 2) params.affiliate = code;
  return { pathname: '/auth' as const, params };
}
