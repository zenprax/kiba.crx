/**
 * One-Time Bypass の純粋判定ロジック（DOM/Chrome API 非依存・テスト可能）。
 *
 * ファイルアップロードの単回例外（BypassGrant）の有効性判定・消費・生成を扱う。
 * 状態の永続化や承認問い合わせは呼び出し側（content/background）の責務。
 */

import type { BypassGrant } from '../types';

/**
 * 付与が現在このドメインで使用可能かを判定する。
 * 条件: 付与が存在し、TTL 内（expiresAt > now）かつ残回数 > 0 かつ domain 一致。
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
 * 付与を 1 回消費した次の状態を返す。残回数が尽きた場合・失効した場合は null。
 */
export function consumeBypass(grant: BypassGrant, now: number = Date.now()): BypassGrant | null {
  if (grant.expiresAt <= now) return null;
  const remainingUses = grant.remainingUses - 1;
  if (remainingUses <= 0) return null;
  return { ...grant, remainingUses };
}

/** 承認結果から新規の単回付与（remainingUses: 1）を TTL 付きで生成する。 */
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
