export type AuthEntryMode = 'login' | 'register';

export function authHref(mode: AuthEntryMode) {
  return { pathname: '/auth' as const, params: { mode } };
}
