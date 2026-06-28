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

import {
  StrictMode,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { cssVariables, getTheme } from '@zenprax/design-tokens';
import { OVERLAY_CSS } from './overlayStyles';

/**
 * Shadow Root に注入する CSS カスタムプロパティを構築する。
 *
 * 色トークンは `cssVariables('dark', ':host')` がそのまま `--zp-*` を生成する。
 * 影・余白・角丸・フォントサイズは色変数に含まれないため、`getTheme('dark')` の
 * Primitive/Semantic 値を overlay 用の `--zp-*` 変数として追記する。これにより
 * overlayStyles.ts 側に生の色・サイズ値を一切持たせず、すべてトークン由来にする。
 */
function buildHostVariables(): string {
  const theme = getTheme('dark');
  // 暗幕（scrim）はベース背景を半透明にしたもの。生 rgba を書かず base 色から合成する。
  const scrim = hexToRgba(theme.color.bg.base, 0.55);

  const extra = [
    `--zp-overlay-scrim: ${scrim};`,
    `--zp-shadow-card: ${theme.shadow.lg};`,
    `--zp-radius-card: ${theme.radius.xl};`,
    `--zp-radius-badge: ${theme.radius.full};`,
    `--zp-radius-btn: ${theme.radius.md};`,
    `--zp-space-card-y: ${theme.spacing['5']};`,
    `--zp-space-card-x: ${theme.spacing['5']};`,
    `--zp-space-btn-y: ${theme.spacing['2']};`,
    `--zp-space-btn-x: ${theme.spacing['4']};`,
    `--zp-space-badge-y: ${theme.spacing['1']};`,
    `--zp-space-badge-x: ${theme.spacing['3']};`,
    `--zp-space-actions-gap: ${theme.spacing['3']};`,
    `--zp-space-title-gap: ${theme.spacing['2']};`,
    `--zp-space-body-gap: ${theme.spacing['5']};`,
    `--zp-fs-badge: ${theme.font.size.sm};`,
    `--zp-fs-title: ${theme.font.size.xl};`,
    `--zp-fs-body: ${theme.font.size.base};`,
    `--zp-fs-btn: ${theme.font.size.base};`,
  ].join('\n  ');

  return `${cssVariables('dark', ':host')}\n:host {\n  ${extra}\n}`;
}

/** `#RRGGBB` を指定アルファの rgba() 文字列へ変換する（生 rgba の直書きを避けるため）。 */
function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
 * Shadow DOM ホストを <dialog> として生成し、showModal() で Top Layer へ昇格させる。
 *
 * Top Layer はブラウザが管理する最上位レイヤーで、ホスト側の transform / filter /
 * contain によるスタッキングコンテキスト切り替えの影響を受けない。
 * <style> は Shadow Root 内に閉じるためホストページの CSS と完全に隔離される。
 */
function render(node: ReactNode): void {
  removeOverlay();

  const host = document.createElement('div');
  // ホスト要素はレイアウトに影響しないオーバーレイ専用コンテナ。
  // all:initial でホストページの継承スタイルをリセットし、固定位置・最大 z-index で最前面を確保する。
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';

  const shadow = host.attachShadow({ mode: 'open' });

  // デザイントークンを :host 上の CSS 変数として定義し、OVERLAY_CSS から参照する。
  const varsEl = document.createElement('style');
  varsEl.textContent = buildHostVariables();
  shadow.appendChild(varsEl);

  const styleEl = document.createElement('style');
  styleEl.textContent = OVERLAY_CSS;
  shadow.appendChild(styleEl);

  // React ルートのマウント先（Shadow Root 内のコンテナ）。
  const container = document.createElement('div');
  shadow.appendChild(container);

  const root = createRoot(container);
  root.render(<StrictMode>{node}</StrictMode>);

  const attach = (): void => {
    (document.body ?? document.documentElement).appendChild(host);
  };

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

/**
 * Non-blocking warning toast shown when a dangerous paste is blocked.
 * 暗幕なしの右下トースト表示にして、裏のページ情報を確認しながら操作できる。
 */
function DangerOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div className="kiba-toast-root">
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

/**
 * ドラッグで移動できるカードラッパ。ヘッダ（kiba-card__drag）を pointerdown して
 * 動かすと transform で位置を更新する。依存追加なし（React の pointer events のみ）。
 */
function DraggableCard({
  className,
  role,
  ariaModal,
  children,
}: {
  className: string;
  role: string;
  ariaModal?: boolean;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );

  const onPointerDown = (e: ReactPointerEvent): void => {
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent): void => {
    if (!drag.current) return;
    setPos({
      x: drag.current.baseX + (e.clientX - drag.current.startX),
      y: drag.current.baseY + (e.clientY - drag.current.startY),
    });
  };
  const onPointerUp = (e: ReactPointerEvent): void => {
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={className}
      role={role}
      aria-modal={ariaModal}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div
        className="kiba-card__drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="kiba-card__badge">kiba.crx</span>
        <span className="kiba-card__drag-dots" aria-hidden>
          ⠿
        </span>
      </div>
      {children}
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
      <DraggableCard className="kiba-card kiba-card--gated" role="dialog" ariaModal>
        <h2 className="kiba-card__title">File Upload Blocked</h2>
        <p className="kiba-card__body">
          Uploads to <strong>{domain}</strong> are restricted by policy. Request a one-time
          exception to upload a single file.
        </p>
        <div className="kiba-card__actions">
          <button className="kiba-btn kiba-btn--ghost" onClick={removeOverlay}>
            Cancel
          </button>
          <button className="kiba-btn kiba-btn--primary" onClick={handleBypass}>
            Request Demo One-Time Bypass
          </button>
        </div>
      </DraggableCard>
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
