/**
 * Pure decision logic for One-Time Bypass (DOM/Chrome API-independent, testable).
 *
 * Handles validity checking, consumption, and creation of a single-use file
 * upload exception (BypassGrant). Persisting state and querying for approval are
 * the responsibility of the caller (content/background).
 */

import type { BypassGrant } from '../types';

/**
 * Determines whether the grant is currently usable on this domain.
 * Conditions: the grant exists, is within TTL (expiresAt > now), has remaining
 * uses > 0, and the domain matches.
 */
export function isBypassValid(
  grant: BypassGrant | null,
  domain: string,
  now: number = Date.now(),
): boolean {
  if (!grant) return false;
  if (grant.domain !== domain) return false;
  if (grant.remainingUses <= 0) return false;
  return grant.expiresAt > now;
}

/**
 * Returns the next state after consuming the grant once. Returns null when the
 * remaining uses are exhausted or it has expired.
 */
export function consumeBypass(grant: BypassGrant, now: number = Date.now()): BypassGrant | null {
  if (grant.expiresAt <= now) return null;
  const remainingUses = grant.remainingUses - 1;
  if (remainingUses <= 0) return null;
  return { ...grant, remainingUses };
}

/** Creates a new single-use grant (remainingUses: 1) with a TTL from an approval result. */
export function makeGrant(
  id: string,
  domain: string,
  ttlMs: number,
  now: number = Date.now(),
): BypassGrant {
  return {
    id,
    domain,
    grantedAt: now,
    expiresAt: now + ttlMs,
    remainingUses: 1,
  };
}
