import { nearbyFriendsConfig } from '../../../config/nearby-friends.config';
import { describe, expect, it } from 'vitest';
import { canonicalUserPair, normalizeCapturedAt } from '../location-policy';

describe('location policy', () => {
  const now = new Date('2026-10-05T08:00:00.000Z');

  it('normalizes a small future clock offset without extending freshness', () => {
    expect(normalizeCapturedAt('2026-10-05T08:00:20.000Z', now)).toEqual(now);
  });

  it('rejects invalid, stale and far future samples', () => {
    for (const sample of [
      'invalid',
      new Date(now.getTime() - nearbyFriendsConfig.location.ttlMs).toISOString(),
      '2026-10-05T08:00:31.000Z',
    ]) {
      expect(() => normalizeCapturedAt(sample, now)).toThrow();
    }
  });

  it('allows a five-hour-old sample by default and respects a custom freshness window', () => {
    const sample = new Date(now.getTime() - 5 * 3_600_000).toISOString();
    expect(normalizeCapturedAt(sample, now)).toEqual(new Date(sample));
    const custom = {
      ...nearbyFriendsConfig,
      location: { ...nearbyFriendsConfig.location, ttlMs: 3_600_000 },
    };
    expect(() => normalizeCapturedAt(sample, now, custom)).toThrow();
  });

  it('uses the same canonical pair for opposite request directions', () => {
    expect(canonicalUserPair('user-b', 'user-a')).toEqual(canonicalUserPair('user-a', 'user-b'));
  });
});
