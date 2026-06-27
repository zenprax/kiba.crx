/**
 * 画面共有監査の isolated-world オーケストレータ。
 *
 * main world（getDisplayMediaPatch.ts）が getDisplayMedia 呼び出しを検知して
 * window.postMessage で通知してくる。本モジュールはそれを受け、マーカーと
 * オリジンを検証してから addAuditLog('screen-share', ...) を記録する。
 *
 * セキュリティ: ページは任意の postMessage を投げられるため、
 *  - event.source === window（同一ウィンドウからのメッセージのみ）
 *  - event.origin === window.location.origin
 *  - data.marker === SCREEN_SHARE_MARKER
 * を全て満たす場合のみ記録する。これによりページが偽メッセージで監査ログを
 * 汚染するのを防ぐ。取得する情報は最小化（href のみ・ストリーム内容には触れない）。
 */

import { addAuditLog } from '../lib/storage';
import { SCREEN_SHARE_MARKER } from './mainWorld/getDisplayMediaPatch';

const HOSTNAME = window.location.hostname;

interface ScreenShareMessage {
  marker: string;
  href?: string;
}

function isScreenShareMessage(data: unknown): data is ScreenShareMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { marker?: unknown }).marker === SCREEN_SHARE_MARKER
  );
}

/**
 * postMessage リスナを登録する。返り値は teardown（リスナ解除）。
 * content オーケストレータの teardown 契約に合わせる。
 */
export function initScreenShareHook(): () => void {
  const handler = (event: MessageEvent<unknown>): void => {
    // 同一ウィンドウ・同一オリジンからのメッセージのみ信頼する。
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (!isScreenShareMessage(event.data)) return;

    void addAuditLog('screen-share', `Screen share requested on ${HOSTNAME}`, HOSTNAME);
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
