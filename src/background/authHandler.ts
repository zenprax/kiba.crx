/**
 * TTL-backed auth / standalone (offline) behaviour.
 *
 * Pure decision logic so it can be unit-tested without Chrome APIs:
 *  - The pseudo-SSO feature is usable only while online and within its TTL.
 *  - Offline behaviour depends on the TTL and the configured offline strategy.
 */

import type { KibaSettings } from '../types';
import { getSettings, setSettings } from '../lib/storage';
import { syncManagedPolicy } from './syncManager';

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

/** OS notification helper (same basic notification format as the content notification path). */
function notify(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
    priority: 1,
  });
}

/**
 * Network-recovery handler: immediately pulls the latest policy.
 * Auth TTL updates and flag changes are written to storage via
 * compileActiveSettings, and the Popup follows along via onSettingsChanged.
 */
async function handleOnline(): Promise<void> {
  await syncManagedPolicy();
}

/**
 * Offline-transition handler: evaluates the current TTL and moves into
 * standalone behavior.
 *  - TTL expired + LOCKDOWN strategy: fail safe into a full lockdown
 *    (disable pseudo-SSO and force ENFORCE). Notify the user.
 *  - Otherwise (TTL valid or FAIL_OPEN): keep operating autonomously. Only
 *    pseudo-SSO is disabled, per the offline-immediate-lock spec (defense in
 *    depth with isSsoUsable).
 */
async function handleOffline(): Promise<void> {
  const settings = await getSettings();
  const behavior = resolveOfflineBehavior(settings, { online: false });

  if (behavior === 'LOCKDOWN') {
    // Auth expired: maximize protection and fail toward blocking everything.
    await setSettings({ mode: 'ENFORCE', ssoEnabled: false });
    notify(
      'kiba.crx — Standalone Lockdown',
      'オフライン・認証期限切れのため保護を強化（ロックダウン）しました。',
    );
    return;
  }

  // Continue autonomous operation. Pseudo-SSO is always locked when offline.
  if (settings.ssoEnabled) {
    await setSettings({ ssoEnabled: false });
    notify(
      'kiba.crx — Pseudo-SSO Locked',
      'オフラインのため擬似SSO（共有アカウント自動入力）を一時無効化しました。',
    );
  }
}

/**
 * Wires up network-state monitoring, driving autonomous behavior on online and
 * offline respectively. The decision logic (isSsoUsable / resolveOfflineBehavior)
 * is still referenced on demand by callers (content) as well.
 */
export function initAuthHandler(): void {
  self.addEventListener('online', () => {
    void handleOnline();
  });
  self.addEventListener('offline', () => {
    void handleOffline();
  });
}
