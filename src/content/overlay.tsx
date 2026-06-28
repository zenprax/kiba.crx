/**
 * Overlay / modal UI utilities (injected DOM) for the content script.
 *
 * The overlay/modal is mounted as React components into a dedicated root
 * (createRoot) inside the **Shadow DOM**. This fully blocks the host page's CSS
 * at the shadow boundary, and these styles never leak to the host page either
 * (replacing the legacy manifest-based <link> injection, which caused global
 * pollution).
 *
 * The public API signatures (notify / showDangerOverlay / showRequestBypassModal
 * / removeOverlay) are unchanged, so the callers (pasteGuard / fileGater)
 * require no modification.
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
import { sendKibaMessage } from '../lib/messaging';

/**
 * Builds the CSS custom properties to inject into the Shadow Root.
 *
 * For color tokens, `cssVariables('dark', ':host')` emits the `--zp-*` variables
 * directly. Shadows, spacing, radii, and font sizes are not included in the
 * color variables, so the Primitive/Semantic values from `getTheme('dark')` are
 * appended as overlay `--zp-*` variables. This keeps overlayStyles.ts free of
 * any raw color/size values, with everything derived from tokens.
 */
function buildHostVariables(): string {
  const theme = getTheme('dark');
  // The scrim is the base background made translucent. Composed from the base color instead of writing raw rgba.
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

/** Converts `#RRGGBB` to an rgba() string with the given alpha (to avoid writing raw rgba directly). */
function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Sends a notification request to the background service worker. */
export function notify(title: string, message: string): void {
  void sendKibaMessage({ kind: 'kiba:notify', title, message });
}

/* ------------------------------------------------------------------ *
 * Single management of the Shadow DOM host + React root
 * ------------------------------------------------------------------ */

/** The currently mounted host element, React root, and Shadow Root tuple. */
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
 * Creates the Shadow DOM host as a <dialog> and promotes it to the Top Layer
 * via showModal().
 *
 * The Top Layer is the browser-managed topmost layer, unaffected by stacking
 * context switches caused by the host's transform / filter / contain. The
 * <style> is scoped within the Shadow Root, so it is fully isolated from the
 * host page's CSS.
 */
function render(node: ReactNode): void {
  removeOverlay();

  const host = document.createElement('div');
  // The host element is an overlay-only container that does not affect layout.
  // all:initial resets inherited styles from the host page; fixed position and max z-index keep it on top.
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';

  const shadow = host.attachShadow({ mode: 'open' });

  // Define design tokens as CSS variables on :host, referenced by OVERLAY_CSS.
  const varsEl = document.createElement('style');
  varsEl.textContent = buildHostVariables();
  shadow.appendChild(varsEl);

  const styleEl = document.createElement('style');
  styleEl.textContent = OVERLAY_CSS;
  shadow.appendChild(styleEl);

  // Mount target for the React root (a container inside the Shadow Root).
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
 * React components (JSX auto-escapes, so escapeHtml is not needed)
 * ------------------------------------------------------------------ */

/**
 * Non-blocking warning toast shown when a dangerous paste is blocked.
 * Displayed as a bottom-right toast with no scrim, so the page behind stays
 * visible and usable.
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
 * A draggable card wrapper. Pointerdown on the header (kiba-card__drag) and
 * move to update the position via transform. No added dependencies (React
 * pointer events only).
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
      // Approval is centralized in the background (bypassManager); granting and audit recording happen there too.
      await sendKibaMessage({ kind: 'kiba:request-bypass', domain });
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
 * Public API (signatures identical to the old overlay.ts)
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
 * Modal that requests a One-Time Bypass.
 *
 * Runs `onConfirm` when provided. When omitted, sends a request message to the
 * background's approval path (bypassManager). Since approval, granting, and
 * audit recording are all handled centrally by the background, storage is not
 * written directly here.
 */
export function showRequestBypassModal(
  domain: string,
  onConfirm?: () => void | Promise<void>,
): void {
  render(<RequestBypassModal domain={domain} onConfirm={onConfirm} />);
}
