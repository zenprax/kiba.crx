/**
 * Unit tests for the TTL / standalone decision logic.
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { isSsoUsable, resolveOfflineBehavior } from './authHandler';
import { DEFAULT_SETTINGS, type KibaSettings, type OfflineStrategy } from '../types';

const NOW = 1_000_000;

/** Builds settings with a specific TTL and offline strategy. */
function makeSettings(
  ssoTtlExpiresAt: number | null,
  offlineStrategy: OfflineStrategy = 'FAIL_OPEN',
): KibaSettings {
  return {
    ...DEFAULT_SETTINGS,
    auth: { ssoTtlExpiresAt, offlineStrategy, idToken: null },
  };
}

describe('isSsoUsable', () => {
  it('is usable when online and TTL is in the future', () => {
    expect(isSsoUsable(makeSettings(NOW + 1000), { online: true, now: NOW })).toBe(true);
  });

  it('is not usable when online but TTL is expired', () => {
    expect(isSsoUsable(makeSettings(NOW - 1000), { online: true, now: NOW })).toBe(false);
  });

  it('is not usable when online but TTL is null', () => {
    expect(isSsoUsable(makeSettings(null), { online: true, now: NOW })).toBe(false);
  });

  it('is never usable when offline, even with a valid TTL', () => {
    expect(isSsoUsable(makeSettings(NOW + 1000), { online: false, now: NOW })).toBe(false);
  });

  it('is not usable when offline with expired TTL', () => {
    expect(isSsoUsable(makeSettings(NOW - 1000), { online: false, now: NOW })).toBe(false);
  });

  it('is not usable when offline with null TTL', () => {
    expect(isSsoUsable(makeSettings(null), { online: false, now: NOW })).toBe(false);
  });
});

describe('resolveOfflineBehavior', () => {
  it('returns NORMAL when online regardless of TTL', () => {
    expect(resolveOfflineBehavior(makeSettings(null), { online: true, now: NOW })).toBe('NORMAL');
    expect(resolveOfflineBehavior(makeSettings(NOW - 1000), { online: true, now: NOW })).toBe(
      'NORMAL',
    );
  });

  it('returns NORMAL when offline and TTL is still valid', () => {
    expect(resolveOfflineBehavior(makeSettings(NOW + 1000), { online: false, now: NOW })).toBe(
      'NORMAL',
    );
  });

  it('returns the offline strategy (LOCKDOWN) when offline and TTL expired', () => {
    expect(
      resolveOfflineBehavior(makeSettings(NOW - 1000, 'LOCKDOWN'), { online: false, now: NOW }),
    ).toBe('LOCKDOWN');
  });

  it('returns the offline strategy (FAIL_OPEN) when offline and TTL expired', () => {
    expect(
      resolveOfflineBehavior(makeSettings(NOW - 1000, 'FAIL_OPEN'), { online: false, now: NOW }),
    ).toBe('FAIL_OPEN');
  });

  it('returns the offline strategy when offline and TTL is null', () => {
    expect(
      resolveOfflineBehavior(makeSettings(null, 'LOCKDOWN'), { online: false, now: NOW }),
    ).toBe('LOCKDOWN');
  });
});
