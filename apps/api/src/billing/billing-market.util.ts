import { billingMarketSnapshot, normalizeCountryCode } from '@tecnowallet/config';

export function countryFromRequest(input: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | null {
  const headers = input.headers ?? {};
  const read = (key: string) => {
    const value = headers[key] ?? headers[key.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  };
  for (const key of [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'cloudfront-viewer-country',
    'x-country-code',
  ]) {
    const country = normalizeCountryCode(read(key));
    if (country) return country;
  }
  return null;
}

export function marketForRequest(input: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  countryCode?: string | null;
}) {
  const country =
    normalizeCountryCode(input.countryCode) ??
    countryFromRequest(input) ??
    null;
  return billingMarketSnapshot(country);
}
