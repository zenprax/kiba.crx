/**
 * Overlay / modal UI utilities (injected DOM) for the content script.
 *
 * Overlays/modals are injected into the page DOM and styled via style.css
 * (bundled as a content-script stylesheet), so no page-side CSS is required.
 * Moved out of content/index.ts so the paste/file modules can share them.
 */

import { addAuditLog, setSettings } from '../lib/storage';

/** Sends a notification request to the background service worker. */
export function notify(title: string, message: string): void {
  chrome.runtime.sendMessage({ kind: 'kiba:notify', title, message });
}

let activeOverlay: HTMLElement | null = null;

/** Removes the currently mounted overlay/modal, if any. */
export function removeOverlay(): void {
  activeOverlay?.remove();
  activeOverlay = null;
}

/** Non-blocking warning overlay shown when a dangerous paste is blocked. */
export function showDangerOverlay(title: string, body: string): void {
  removeOverlay();

  const root = document.createElement('div');
  root.className = 'kiba-overlay-root';
  root.innerHTML = `
    <div class="kiba-card kiba-card--danger" role="alertdialog" aria-live="assertive">
      <div class="kiba-card__badge">kiba.crx</div>
      <h2 class="kiba-card__title">${escapeHtml(title)}</h2>
      <p class="kiba-card__body">${escapeHtml(body)}</p>
      <div class="kiba-card__actions">
        <button class="kiba-btn kiba-btn--primary" data-kiba-action="dismiss">Dismiss</button>
      </div>
    </div>
  `;

  root.querySelector('[data-kiba-action="dismiss"]')?.addEventListener('click', removeOverlay);
  mount(root);

  // Auto-dismiss after a short window so the page is not left blocked.
  window.setTimeout(() => {
    if (activeOverlay === root) removeOverlay();
  }, 6000);
}

/**
 * Modal asking the user to request a one-time upload bypass.
 *
 * `onConfirm` runs when the user requests the bypass; it lets the caller decide
 * how the one-time token is granted/logged. When omitted, the legacy behaviour
 * is preserved: the single-use token is activated and the grant is recorded
 * directly from here.
 */
export function showRequestBypassModal(
  domain: string,
  onConfirm?: () => void | Promise<void>,
): void {
  removeOverlay();

  const root = document.createElement('div');
  root.className = 'kiba-overlay-root';
  root.innerHTML = `
    <div class="kiba-card kiba-card--gated" role="dialog" aria-modal="true">
      <div class="kiba-card__badge">kiba.crx</div>
      <h2 class="kiba-card__title">File Upload Blocked</h2>
      <p class="kiba-card__body">
        Uploads to <strong>${escapeHtml(domain)}</strong> are restricted by policy.
        Request a one-time exception to upload a single file.
      </p>
      <div class="kiba-card__actions">
        <button class="kiba-btn kiba-btn--ghost" data-kiba-action="dismiss">Cancel</button>
        <button class="kiba-btn kiba-btn--primary" data-kiba-action="bypass">
          Request Demo One-Time Bypass
        </button>
      </div>
    </div>
  `;

  root.querySelector('[data-kiba-action="dismiss"]')?.addEventListener('click', removeOverlay);
  root.querySelector('[data-kiba-action="bypass"]')?.addEventListener('click', async () => {
    if (onConfirm) {
      await onConfirm();
    } else {
      // Legacy behaviour: activate the simulated single-use token and record it.
      await setSettings({ oneTimeBypassActive: true });
      await addAuditLog('bypass-grant', 'One-Time Bypass granted', domain);
      notify('kiba.crx', 'One-Time Bypass granted. Re-select your file to upload.');
    }
    removeOverlay();
  });

  mount(root);
}

/** Appends an overlay root to the document, deferring until <body> exists. */
export function mount(root: HTMLElement): void {
  const attach = () => {
    (document.body ?? document.documentElement).appendChild(root);
    activeOverlay = root;
  };
  if (document.body) {
    attach();
  } else {
    // document_start: body may not exist yet.
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  }
}

/** Escapes a string for safe interpolation into overlay innerHTML. */
export function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
