/**
 * kiba.crx の注入オーバーレイ／ファイルバイパスモーダル用スタイル。
 *
 * これらは Shadow Root 内に <style> として注入されるため、ホストページの CSS とは
 * 完全に隔離される（こちらのスタイルもホストページへ漏れない）。
 *
 * 色・影・余白・角丸・フォントサイズはすべて @zenprax/design-tokens 由来の CSS
 * カスタムプロパティ（`--zp-*`）を参照する。これらの変数は overlay.tsx が
 * `cssVariables('dark', ':host')` と `getTheme('dark')` から組み立てて :host へ
 * 注入する。ここに生の色コード・生の rgba・生のサイズ値は書かない
 * （唯一の例外は「器」の最大幅 min(420px, 90vw)）。
 * Tailwind は意図的に使わない（ホストページはこちらの Tailwind ビルドを読み込まない）。
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
 * Toast 表示（DangerOverlay 用）: 暗幕なしで画面右下に出す。裏の情報を
 * 確認しながら閲覧できる。scrim を持たないため pointer-events も背面に通す。
 * ------------------------------------------------------------------ */
.kiba-toast-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: var(--zp-space-card-x);
  pointer-events: none; /* 背面のページ操作を妨げない */
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

.kiba-toast-root .kiba-card {
  pointer-events: auto; /* カード自体は操作可能 */
  animation: kiba-slide-in 160ms ease-out;
}

/* ------------------------------------------------------------------ *
 * ドラッグ可能ヘッダ（RequestBypassModal 用）。
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
