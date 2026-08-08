export const API_VERSION = 'v1';
export const API_PREFIX = `api/${API_VERSION}`;
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_LOCALE = 'es';

export const financialLimits = {
  maxPageSize: 100,
  defaultPageSize: 30,
  maxAttachmentBytes: 10 * 1024 * 1024,
  accessTokenMinutes: 15,
  refreshTokenDays: 30,
} as const;
