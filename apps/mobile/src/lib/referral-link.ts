/** Parse `/r/CODE` from TecnoWallet web or universal-link URLs. */
export function parseReferralCodeFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url, 'https://tecnowallet.app');
    const match = parsed.pathname.match(/^\/r\/([^/?#]+)/i);
    if (!match?.[1]) return null;
    const code = decodeURIComponent(match[1]).trim().toUpperCase();
    return code.length >= 2 ? code : null;
  } catch {
    return null;
  }
}

export function branchReferralDownloadUrl(
  code: string,
  branchUrl?: string | null,
): string {
  const normalized = code.trim().toUpperCase();
  const base =
    branchUrl?.trim() ||
    `https://${process.env.EXPO_PUBLIC_BRANCH_DOMAIN || 'tecnowallet.app.link'}`;
  try {
    const url = new URL(base);
    url.searchParams.set('affiliate_code', normalized);
    url.searchParams.set('code', normalized);
    url.searchParams.set(
      '$canonical_url',
      `https://tecnowallet.app/r/${encodeURIComponent(normalized)}`,
    );
    return url.toString();
  } catch {
    return `https://tecnowallet.app/r/${encodeURIComponent(normalized)}`;
  }
}
