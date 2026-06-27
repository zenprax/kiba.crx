/**
 * Overlay / modal UI utilities (injected DOM) for the content script.
 *
 * オーバーレイ/モーダルは React コンポーネントとして **Shadow DOM** 内の専用
 * ルート（createRoot）へマウントする。これによりホストページの CSS は Shadow
 * 境界で完全に遮断され、こちらのスタイルもホストページへ一切漏れない（旧来の
 * manifest 経由 <link> 注入＝グローバル汚染を廃止）。
 *
 * 公開 API（notify / showDangerOverlay / showRequestBypassModal / removeOverlay）の
 * シグネチャは従来どおりで、呼び出し側（pasteGuard / fileGater）は無改修。
 */

import { StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OVERLAY_CSS } from './overlayStyles';

/** Sends a notification request to the background service worker. */
export function notify(title: string, message: string): void {
  chrome.runtime.sendMessage({ kind: 'kiba:notify', title, message });
}

/* ------------------------------------------------------------------ *
 * Shadow DOM ホスト + React ルートの単一管理
 * ------------------------------------------------------------------ */

/** 現在マウント中のホスト要素・React ルート・Shadow Root の組。 */
interface MountedOverlay {
  host: HTMLElement;
  shadow: ShadowRoot;
  root: Root;
}

let active: MountedOverlay | null = null;

/** Removes the currently mounted overlay/modal, if any. */
export function removeOverlay(): void {
  if (!active) return;
  active.root.unmount();
  active.host.remove();
  active = null;
}

/**
 * Shadow DOM ホストを生成し、与えた React ノードをその中の専用ルートへマウントする。
 *
 * <style> を Shadow Root 内に注入することで、スタイルは Shadow 境界に閉じる。
 * ホスト要素自体は最小限のスタイルのみ持ち（位置は overlay 側の CSS が担う）、
 * z-index で最前面を確保する。
 */
function render(node: ReactNode): void {
  removeOverlay();

  const host = document.createElement('div');
  // ホスト要素はレイアウトに影響しないオーバーレイ専用コンテナ。
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.top = '0';
  host.style.left = '0';

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = OVERLAY_CSS;
  shadow.appendChild(styleEl);

  // React ルートのマウント先（Shadow Root 内のコンテナ）。
  const container = document.createElement('div');
  shadow.appendChild(container);

  const root = createRoot(container);
  root.render(<StrictMode>{node}</StrictMode>);

  const attach = () => (document.body ?? document.documentElement).appendChild(host);
  if (document.body) {
    attach();
  } else {
    // document_start: body may not exist yet.
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  }

  active = { host, shadow, root };
}

/* ------------------------------------------------------------------ *
 * React コンポーネント（JSX が自動エスケープするため escapeHtml 不要）
 * ------------------------------------------------------------------ */

/** Non-blocking warning overlay shown when a dangerous paste is blocked. */
function DangerOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div className="kiba-overlay-root">
      <div className="kiba-card kiba-card--danger" role="alertdialog" aria-live="assertive">
        <div className="kiba-card__badge">kiba.crx</div>
        <h2 className="kiba-card__title">{title}</h2>
        <p className="kiba-card__body">{body}</p>
        <div className="kiba-card__actions">
          <button className="kiba-btn kiba-btn--primary" onClick={removeOverlay}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/** File-upload bypass request modal. */
function RequestBypassModal({
  domain,
  onConfirm,
}: {
  domain: string;
  onConfirm?: () => void | Promise<void>;
}) {
  const handleBypass = async () => {
    if (onConfirm) {
      await onConfirm();
    } else {
      // 承認は background（bypassManager）に一元化。付与・audit 記録もそちらで行う。
      await chrome.runtime.sendMessage({ kind: 'kiba:request-bypass', domain });
      notify('kiba.crx', 'One-Time Bypass granted. Re-select your file to upload.');
    }
    removeOverlay();
  };

  return (
    <div className="kiba-overlay-root">
      <div className="kiba-card kiba-card--gated" role="dialog" aria-modal="true">
        <div className="kiba-card__badge">kiba.crx</div>
        <h2 className="kiba-card__title">File Upload Blocked</h2>
        <p className="kiba-card__body">
          Uploads to <strong>{domain}</strong> are restricted by policy. Request a
          one-time exception to upload a single file.
        </p>
        <div className="kiba-card__actions">
          <button className="kiba-btn kiba-btn--ghost" onClick={removeOverlay}>
            Cancel
          </button>
          <button className="kiba-btn kiba-btn--primary" onClick={handleBypass}>
            Request Demo One-Time Bypass
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 公開 API（シグネチャは旧 overlay.ts と同一）
 * ------------------------------------------------------------------ */

/** Non-blocking warning overlay shown when a dangerous paste is blocked. */
export function showDangerOverlay(title: string, body: string): void {
  render(<DangerOverlay title={title} body={body} />);

  // Auto-dismiss after a short window so the page is not left blocked.
  const mounted = active;
  window.setTimeout(() => {
    if (active === mounted) removeOverlay();
  }, 6000);
}

/**
 * One-Time Bypass を要求するモーダル。
 *
 * `onConfirm` が渡された場合はそれを実行する。省略時は background の承認経路
 * （bypassManager）へ要求メッセージを送る。承認・付与・audit 記録はすべて
 * background が一元的に行うため、ここでは storage を直接書き換えない。
 */
export function showRequestBypassModal(
  domain: string,
  onConfirm?: () => void | Promise<void>,
): void {
  render(<RequestBypassModal domain={domain} onConfirm={onConfirm} />);
}
