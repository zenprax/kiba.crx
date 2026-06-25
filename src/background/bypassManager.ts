/**
 * One-Time Bypass の承認経路（background 一元管理）。
 *
 * ファイルアップロードの単回例外は、コンソールの承認エンジンが発行する。
 * CONSOLE_CONFIG.bypassApprovalUrl が:
 *  - null      : ローカル即時承認（コンソール公開前のフォールバック）。
 *  - 設定済み  : コンソールへ承認問い合わせし、承認 ID と TTL を受領する。
 *
 * いずれの経路でも付与成功時に audit ログへ記録し、付与レコードを storage に
 * 保存する（content からの問い合わせに応答する）。
 */

import { CONSOLE_CONFIG } from '../lib/consoleClient';
import { makeGrant } from '../lib/bypass';
import { addAuditLog, setSettings } from '../lib/storage';
import type { BypassGrant } from '../types';

/** ローカル即時承認時に用いる既定 TTL（5 分）。 */
const LOCAL_BYPASS_TTL_MS = 5 * 60_000;

/** コンソール承認 API のレスポンス想定形。 */
interface ApprovalResponse {
  /** 承認 ID（サーバ発番）。 */
  id: string;
  /** 付与の有効期間（ミリ秒）。 */
  ttlMs: number;
}

/** unknown を ApprovalResponse として検証する型ガード。 */
function isApprovalResponse(value: unknown): value is ApprovalResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApprovalResponse).id === 'string' &&
    typeof (value as ApprovalResponse).ttlMs === 'number'
  );
}

/**
 * 指定ドメインに対する One-Time Bypass を要求する。承認されれば付与レコードを
 * storage に保存し audit ログへ記録して返す。拒否・失敗時は null。
 */
export async function requestBypass(domain: string): Promise<BypassGrant | null> {
  const { bypassApprovalUrl } = CONSOLE_CONFIG;
  let grant: BypassGrant | null = null;

  if (bypassApprovalUrl === null) {
    // ローカル即時承認（デモ挙動）。承認 ID はローカル生成の UUID。
    grant = makeGrant(crypto.randomUUID(), domain, LOCAL_BYPASS_TTL_MS);
  } else {
    try {
      const res = await fetch(bypassApprovalUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (!isApprovalResponse(data)) return null;
      grant = makeGrant(data.id, domain, data.ttlMs);
    } catch {
      return null;
    }
  }

  await setSettings({ oneTimeBypass: grant });
  await addAuditLog('bypass-grant', `One-Time Bypass granted (${grant.id})`, domain);
  return grant;
}

/** content からの承認要求メッセージに応答する。index.ts の onMessage から委譲。 */
export function initBypassManager(): void {
  // 実体のメッセージング配線は background/index.ts の onMessage 集約側で行う。
  // ここでは将来の状態初期化フックの置き場所として init を維持する。
}
