/**
 * TTL-backed auth / standalone (offline) behaviour.
 *
 * Pure decision logic so it can be unit-tested without Chrome APIs:
 *  - The pseudo-SSO feature is usable only while online and within its TTL.
 *  - Offline behaviour depends on the TTL and the configured offline strategy.
 */

import type { KibaSettings } from '../types';

/** Inputs describing the current connectivity and clock. */
export interface AuthContext {
  /** Whether the edge currently has connectivity. */
  online: boolean;
  /** Epoch ms override for testing; defaults to Date.now(). */
  now?: number;
}

/** Resolved behaviour for blocking actions given connectivity + TTL state. */
export type OfflineBehavior = 'NORMAL' | 'LOCKDOWN' | 'FAIL_OPEN';

/** True only when the SSO/auth TTL is set and still in the future. */
function isTtlValid(settings: KibaSettings, now: number): boolean {
  const expiresAt = settings.auth.ssoTtlExpiresAt;
  return expiresAt !== null && expiresAt > now;
}

/**
 * Whether the pseudo-SSO autofill may be used right now. Offline always forces
 * a lock (false); online requires a non-expired TTL.
 */
export function isSsoUsable(settings: KibaSettings, opts: AuthContext): boolean {
  if (!opts.online) return false;
  const now = opts.now ?? Date.now();
  return isTtlValid(settings, now);
}

/**
 * Resolves how blocking actions behave given connectivity and TTL:
 *  - online: 'NORMAL'.
 *  - offline + TTL still valid: 'NORMAL' (autonomous standalone operation).
 *  - offline + TTL expired/null: the configured offlineStrategy.
 */
export function resolveOfflineBehavior(settings: KibaSettings, opts: AuthContext): OfflineBehavior {
  if (opts.online) return 'NORMAL';
  const now = opts.now ?? Date.now();
  if (isTtlValid(settings, now)) return 'NORMAL';
  return settings.auth.offlineStrategy;
}

/**
 * Wires up connectivity monitoring. Minimal skeleton: the decision logic above
 * is consumed on demand by callers, so this only logs transitions for now.
 */
export function initAuthHandler(): void {
  self.addEventListener('online', () => {
    // TODO: re-evaluate SSO/standalone state and refresh dependent UI.
  });
  self.addEventListener('offline', () => {
    // TODO: enter standalone mode; pseudo-SSO is locked while offline.
  });
}
