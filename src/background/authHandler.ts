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

/** OS 通知のヘルパー（content の通知経路と同じ basic 通知形式）。 */
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
 * ネットワーク復帰時の処理：最新ポリシーを即時 pull する。
 * 認証 TTL 更新やフラグ反映は compileActiveSettings 経由でストレージに書かれ、
 * Popup は onSettingsChanged で追随する。
 */
async function handleOnline(): Promise<void> {
  await syncManagedPolicy();
}

/**
 * オフライン遷移時の処理：現在の TTL を評価し、スタンドアローン挙動へ移行する。
 *  - TTL 切れ＋戦略 LOCKDOWN: フル・ロックダウンとして安全側へ寄せる
 *    （擬似 SSO を無効化し、ENFORCE を強制）。ユーザーへ通知する。
 *  - それ以外（TTL 有効 or FAIL_OPEN）: 自律駆動を継続。擬似 SSO だけは
 *    オフライン即ロックの仕様に従い無効化する（isSsoUsable と二重防御）。
 */
async function handleOffline(): Promise<void> {
  const settings = await getSettings();
  const behavior = resolveOfflineBehavior(settings, { online: false });

  if (behavior === 'LOCKDOWN') {
    // 認証期限切れ：保護を最大化して全遮断側へ倒す。
    await setSettings({ mode: 'ENFORCE', ssoEnabled: false });
    notify(
      'kiba.crx — Standalone Lockdown',
      'オフライン・認証期限切れのため保護を強化（ロックダウン）しました。',
    );
    return;
  }

  // 自律駆動継続。擬似 SSO はオフラインで必ずロックする。
  if (settings.ssoEnabled) {
    await setSettings({ ssoEnabled: false });
    notify(
      'kiba.crx — Pseudo-SSO Locked',
      'オフラインのため擬似SSO（共有アカウント自動入力）を一時無効化しました。',
    );
  }
}

/**
 * ネットワーク状態の監視を配線する。online/offline それぞれで自律挙動を駆動する。
 * 判定ロジック（isSsoUsable / resolveOfflineBehavior）は引き続きオンデマンドで
 * 呼び出し側（content）からも参照される。
 */
export function initAuthHandler(): void {
  self.addEventListener('online', () => {
    void handleOnline();
  });
  self.addEventListener('offline', () => {
    void handleOffline();
  });
}
