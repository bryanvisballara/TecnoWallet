import { calculateProgress, digestInviteToken } from './recaudos.module';

describe('Recaudos invariants', () => {
  it('calculates progress from server-side minor units', () => {
    expect(calculateProgress(2_505, 10_000)).toBe(25.05);
    expect(calculateProgress(12_000, 10_000)).toBe(120);
    expect(calculateProgress(100, 0)).toBe(0);
  });

  it('stores a deterministic hash instead of the invite token', () => {
    const token = 'a-secret-random-invite-token';
    const digest = digestInviteToken(token);

    expect(digest).toHaveLength(64);
    expect(digest).not.toContain(token);
    expect(digestInviteToken(token)).toBe(digest);
    expect(digestInviteToken(`${token}-different`)).not.toBe(digest);
  });
});
