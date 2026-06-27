/**
 * Main-world hook for navigator.mediaDevices.getDisplayMedia (画面共有監査)。
 *
 * このスクリプトは content_scripts の `world: 'MAIN'` で注入され、ページと同一の
 * JS コンテキストで動く。そのため `navigator.mediaDevices.getDisplayMedia` を
 * 直接ラップできる（isolated world からはページの navigator を差し替えられない）。
 *
 * 重要な制約・方針:
 *  - main world からは chrome.storage / chrome.runtime に直接アクセスできない。
 *    監査記録は window.postMessage で isolated world 側（screenShareHook.ts）へ
 *    委譲する。メッセージにはマーカーを付け、受信側でオリジン検証する。
 *  - 監査は best-effort。ページから読める/改変されうるので強制ブロックではない。
 *  - 元の getDisplayMedia は **必ず呼ぶ**（共有自体はブロックしない＝Web 互換性維持）。
 */

/** isolated world と共有する postMessage マーカー（偽メッセージ識別用）。 */
export const SCREEN_SHARE_MARKER = 'kiba:screen-share-request';

function installHook(): void {
  const md = navigator.mediaDevices;
  // 一部環境では mediaDevices / getDisplayMedia が未定義。何もしない。
  if (!md || typeof md.getDisplayMedia !== 'function') return;

  const original = md.getDisplayMedia.bind(md);

  // 二重注入を防ぐためのフラグ（同一フレームで複数回評価された場合）。
  const flag = '__kibaDisplayMediaHooked';
  const w = window as unknown as Record<string, unknown>;
  if (w[flag]) return;
  w[flag] = true;

  md.getDisplayMedia = function patched(
    this: MediaDevices,
    ...args: [DisplayMediaStreamOptions?]
  ): Promise<MediaStream> {
    try {
      window.postMessage(
        { marker: SCREEN_SHARE_MARKER, href: window.location.href },
        window.location.origin,
      );
    } catch {
      // postMessage 失敗は監査の取りこぼしに留め、機能は通す。
    }
    // 元の挙動を維持（ブロックしない）。
    return original(...args);
  };
}

installHook();
