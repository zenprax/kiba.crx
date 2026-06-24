/**
 * kiba.crx content script (isolated world, document_start).
 *
 * Implements two edge-security controls:
 *  1. Anti-ClickFix paste sanitizer  — blocks dangerous OS-command pastes.
 *  2. File-upload interceptor         — gates uploads on non-whitelisted
 *     domains behind a simulated "One-Time Bypass" token.
 *
 * Overlays/modals are injected into the page DOM and styled via style.css
 * (bundled as a content-script stylesheet), so no page-side CSS is required.
 */

import {
  describeMask,
  describePasteThreat,
  isDangerousPaste,
  sanitizePaste,
} from '../lib/patterns';
import { detectTenant, isTrustedTenant } from '../lib/tenantDetector';
import { addAuditLog, getSettings, onSettingsChanged, setSettings } from '../lib/storage';
import { DEFAULT_SETTINGS, WHITELISTED_DOMAINS, type KibaSettings } from '../types';
import { initSsoHandler } from './ssoHandler';

const HOSTNAME = window.location.hostname;

/**
 * Cached copy of settings kept in sync via chrome.storage.onChanged so the
 * paste handler can decide synchronously (paste events can't await).
 */
let settings: KibaSettings | null = null;

void getSettings().then((s) => {
  settings = s;
  // Feature B: attempt pseudo-SSO autofill once settings (and thus the SSO
  // toggle + credentials) are available.
  initSsoHandler(() => settings);
});
onSettingsChanged((s) => {
  settings = s;
});

function isWhitelistedDomain(host: string): boolean {
  return WHITELISTED_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

/**
 * Decides whether the current page is a *restricted context* — i.e. a foreign
 * ("他社") tenant on a known SaaS, or (for unknown providers) a host that is not
 * on the domain whitelist.
 *
 * Tenant identification (Feature A) takes precedence: on a known provider we
 * trust only whitelisted tenant ids. When the provider is 'unknown' we fall
 * back to the legacy host-based domain whitelist so behaviour is unchanged for
 * non-SaaS sites.
 */
function isRestrictedContext(): boolean {
  const ctx = detectTenant(window.location.href);
  const whitelist = settings?.tenantWhitelist ?? DEFAULT_SETTINGS.tenantWhitelist;

  if (ctx.provider === 'unknown') {
    // No tenant signal: defer to host-based whitelisting.
    return !isWhitelistedDomain(HOSTNAME);
  }
  return !isTrustedTenant(ctx, whitelist);
}

function notify(title: string, message: string): void {
  chrome.runtime.sendMessage({ kind: 'kiba:notify', title, message });
}

/* ------------------------------------------------------------------ *
 * Overlay / modal UI (injected DOM)
 * ------------------------------------------------------------------ */

let activeOverlay: HTMLElement | null = null;

function removeOverlay(): void {
  activeOverlay?.remove();
  activeOverlay = null;
}

/** Non-blocking warning overlay shown when a dangerous paste is blocked. */
function showDangerOverlay(title: string, body: string): void {
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

/** Modal asking the user to request a one-time upload bypass. */
function showRequestBypassModal(domain: string): void {
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
    // Activate the simulated single-use token and record the grant.
    await setSettings({ oneTimeBypassActive: true });
    await addAuditLog('bypass-grant', 'One-Time Bypass granted', domain);
    notify('kiba.crx', 'One-Time Bypass granted. Re-select your file to upload.');
    removeOverlay();
  });

  mount(root);
}

function mount(root: HTMLElement): void {
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

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

/* ------------------------------------------------------------------ *
 * Feature 2: Anti-ClickFix paste sanitizer
 * ------------------------------------------------------------------ */

/**
 * Inserts sanitized text in place of the original paste. Uses the legacy but
 * widely-supported execCommand('insertText') which integrates with the page's
 * undo stack and respects the current selection/caret in inputs and
 * contenteditable. Falls back to direct value manipulation for inputs.
 */
function insertSanitizedText(text: string): void {
  if (document.execCommand('insertText', false, text)) return;

  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

document.addEventListener(
  'paste',
  (event: ClipboardEvent) => {
    // Respect the admin toggle; default to enabled until settings load.
    if (settings && !settings.antiClickFixEnabled) return;

    const pastedText = event.clipboardData?.getData('text') ?? '';

    // Stage 1: dangerous OS commands are always fully blocked. Evaluated FIRST
    // so a command can never slip through the masking path below.
    if (isDangerousPaste(pastedText)) {
      event.preventDefault();
      event.stopPropagation();
      showDangerOverlay(
        'Blocked Dangerous Paste',
        'The text you tried to paste contains administrative OS commands. The paste operation was cancelled.',
      );
      void addAuditLog('paste-block', describePasteThreat(pastedText), HOSTNAME);
      return;
    }

    // Stage 2: in a restricted (foreign-tenant) context, mask confidential data
    // and allow the cleansed text through instead of blocking the paste.
    const maskEnabled = settings?.maskEnabled ?? true;
    if (!maskEnabled || !isRestrictedContext()) return;

    const result = sanitizePaste(pastedText);
    if (!result.masked) return;

    event.preventDefault();
    event.stopPropagation();
    insertSanitizedText(result.sanitized);
    void addAuditLog('paste-mask', describeMask(result), HOSTNAME);
  },
  true, // capture phase: intercept before the page sees it
);

/* ------------------------------------------------------------------ *
 * Feature 3: File-upload interceptor + One-Time Bypass simulation
 * ------------------------------------------------------------------ */

/**
 * Decides whether an upload on the current domain should be gated and, if so,
 * handles the block/bypass workflow. Returns true if the upload was blocked.
 */
async function handleUploadAttempt(reset: () => void): Promise<boolean> {
  if (!isRestrictedContext()) return false;

  const current = await getSettings();
  if (current.oneTimeBypassActive) {
    // Consume the single-use token and allow this upload through.
    await setSettings({ oneTimeBypassActive: false });
    notify('kiba.crx', 'One-Time Upload allowed and consumed.');
    return false;
  }

  reset();
  await addAuditLog('file-block', `Blocked file upload on ${HOSTNAME}`, HOSTNAME);
  showRequestBypassModal(HOSTNAME);
  return true;
}

document.addEventListener(
  'change',
  (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.type !== 'file' || !target.files || target.files.length === 0) {
      return;
    }
    // Block synchronously; resolve the async policy decision immediately after.
    // We optimistically prevent default and only re-allow on bypass.
    event.preventDefault();
    event.stopPropagation();

    void handleUploadAttempt(() => {
      target.value = '';
    }).then((blocked) => {
      if (!blocked) {
        // Token consumed: notify the user to retrigger; we cannot replay the
        // original file selection programmatically from the isolated world.
        notify('kiba.crx', 'Upload permitted. Please re-select your file to proceed.');
      }
    });
  },
  true,
);

// Intercept drag-and-drop file transfers onto the page.
// Drop is not awaitable, so in a restricted context we block eagerly and
// resolve the (single-use) bypass token afterwards.
document.addEventListener(
  'drop',
  (event: DragEvent) => {
    const hasFiles = (event.dataTransfer?.files?.length ?? 0) > 0;
    if (!hasFiles) return;
    if (!isRestrictedContext()) return;

    event.preventDefault();
    event.stopPropagation();

    void getSettings().then(async (current) => {
      if (current.oneTimeBypassActive) {
        await setSettings({ oneTimeBypassActive: false });
        notify('kiba.crx', 'One-Time drop allowed and consumed. Please drop the file again.');
        return;
      }
      await addAuditLog('file-block', `Blocked file drop on ${HOSTNAME}`, HOSTNAME);
      showRequestBypassModal(HOSTNAME);
    });
  },
  true,
);
