/**
 * Styles for kiba.crx's injected overlay / file-bypass modal.
 *
 * These are injected as a <style> inside the Shadow Root, so they are fully
 * isolated from the host page's CSS (and these styles never leak to the host
 * page either).
 *
 * Colors, shadows, spacing, radii, and font sizes all reference CSS custom
 * properties (`--zp-*`) derived from `@zenprax/design-tokens`. overlay.tsx builds
 * these variables from `cssVariables('dark', ':host')` and `getTheme('dark')`
 * and injects them into :host. Do not write raw color codes, raw rgba, or raw
 * size values here (the only exception is the container's max width
 * min(420px, 90vw)). Tailwind is intentionally not used (the host page does not
 * load our Tailwind build).
 */
export const OVERLAY_CSS = `
.kiba-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zp-overlay-scrim);
  backdrop-filter: blur(2px);
  font-family: Inter, system-ui, -apple-system, sans-serif;
  animation: kiba-fade-in 120ms ease-out;
}

.kiba-card {
  width: min(420px, 90vw);
  background: var(--zp-bg-surface);
  color: var(--zp-text-primary);
  border-radius: var(--zp-radius-card);
  border: 1px solid var(--zp-border-default);
  box-shadow: var(--zp-shadow-card);
  padding: var(--zp-space-card-y) var(--zp-space-card-x);
  animation: kiba-pop-in 140ms ease-out;
}

.kiba-card--danger {
  border-color: var(--zp-severity-critical-border);
}

.kiba-card__badge {
  display: inline-block;
  font-size: var(--zp-fs-badge);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--zp-brand-primary);
  background: var(--zp-brand-muted);
  border-radius: var(--zp-radius-badge);
  padding: var(--zp-space-badge-y) var(--zp-space-badge-x);
  margin-bottom: var(--zp-space-title-gap);
}

.kiba-card--danger .kiba-card__badge {
  color: var(--zp-severity-critical-text);
  background: var(--zp-severity-critical-bg);
}

.kiba-card__title {
  margin: 0 0 var(--zp-space-title-gap);
  font-size: var(--zp-fs-title);
  font-weight: 700;
  line-height: 1.3;
}

.kiba-card__body {
  margin: 0 0 var(--zp-space-body-gap);
  font-size: var(--zp-fs-body);
  line-height: 1.5;
  color: var(--zp-text-secondary);
}

.kiba-card__body strong {
  color: var(--zp-text-primary);
}

.kiba-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--zp-space-actions-gap);
}

.kiba-btn {
  font-size: var(--zp-fs-btn);
  font-weight: 600;
  border-radius: var(--zp-radius-btn);
  padding: var(--zp-space-btn-y) var(--zp-space-btn-x);
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter 120ms ease, background 120ms ease;
}

.kiba-btn--primary {
  background: var(--zp-brand-primary);
  color: var(--zp-text-on-brand);
}

.kiba-btn--primary:hover {
  filter: brightness(1.08);
}

.kiba-btn--ghost {
  background: transparent;
  color: var(--zp-text-secondary);
  border-color: var(--zp-border-default);
}

.kiba-btn--ghost:hover {
  background: var(--zp-interactive-hover);
}

/* ------------------------------------------------------------------ *
 * Toast display (for DangerOverlay): shown at the bottom-right with no scrim,
 * so the page behind stays visible. Having no scrim, pointer-events also pass
 * through to the page behind.
 * ------------------------------------------------------------------ */
.kiba-toast-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: var(--zp-space-card-x);
  pointer-events: none; /* do not block interaction with the page behind */
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

.kiba-toast-root .kiba-card {
  pointer-events: auto; /* the card itself remains interactive */
  animation: kiba-slide-in 160ms ease-out;
}

/* ------------------------------------------------------------------ *
 * Draggable header (for RequestBypassModal).
 * ------------------------------------------------------------------ */
.kiba-card__drag {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: calc(-1 * var(--zp-space-card-y)) calc(-1 * var(--zp-space-card-x))
    var(--zp-space-title-gap);
  padding: var(--zp-space-badge-y) var(--zp-space-card-x);
  cursor: grab;
  border-bottom: 1px solid var(--zp-border-default);
  user-select: none;
  touch-action: none;
}

.kiba-card__drag:active {
  cursor: grabbing;
}

.kiba-card__drag-dots {
  color: var(--zp-text-muted);
  letter-spacing: 0.15em;
  font-weight: 700;
}

@keyframes kiba-slide-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes kiba-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes kiba-pop-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
`;
