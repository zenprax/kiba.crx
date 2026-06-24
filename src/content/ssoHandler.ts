/**
 * Content-side controller for the pseudo-SSO autofill (Feature B).
 *
 * Watches for navigation to a configured login URL and, when the page is not
 * being inspected via DevTools, injects the shared-account credentials into the
 * login form (optionally auto-submitting to minimise DOM exposure time).
 *
 * Credentials are read from settings (an MVP mock); they are only ever held in
 * the in-memory settings object passed in via `getSettings`. See ssoFiller.ts
 * for the production-security caveat.
 */

import {
  fillCredentials,
  isDevToolsLikelyOpen,
  matchCredential,
  type FillResult,
} from '../lib/ssoFiller';
import { addAuditLog } from '../lib/storage';
import type { KibaSettings } from '../types';

/** How long to keep watching for a (possibly SPA-rendered) password field. */
const OBSERVE_TIMEOUT_MS = 8000;

function notify(title: string, message: string): void {
  chrome.runtime.sendMessage({ kind: 'kiba:notify', title, message });
}

/** True when the current document already exposes a password field to fill. */
function hasLoginForm(): boolean {
  return document.querySelector('input[type="password"]') !== null;
}

/**
 * Initialises the SSO handler. Reads live settings via `getSettings` so it
 * always honours the latest toggle/credential state. Safe to call once at
 * content-script startup.
 */
export function initSsoHandler(getSettings: () => KibaSettings | null): void {
  const settings = getSettings();
  // Only proceed when enabled and a credential matches this page.
  if (!settings || !settings.ssoEnabled) return;

  const cred = matchCredential(window.location.href, settings.ssoCredentials);
  if (!cred) return;

  // DevTools-open policy: halt autofill so the password is never injected while
  // someone is inspecting the DOM.
  if (isDevToolsLikelyOpen(window)) {
    notify('kiba.crx', 'SSO autofill halted: developer tools appear to be open.');
    void addAuditLog('sso-fill', 'SSO autofill blocked (DevTools detected)', window.location.hostname);
    return;
  }

  const run = (): void => {
    const result: FillResult = fillCredentials(document, cred);
    if (result.filled) {
      const detail = result.submitted
        ? 'SSO autofill + auto-submit executed'
        : 'SSO autofill executed';
      void addAuditLog('sso-fill', detail, window.location.hostname);
    }
  };

  if (hasLoginForm()) {
    run();
    return;
  }

  // SPA login forms may render after document_start. Watch for the password
  // field to appear, then fill once. Give up after a timeout.
  const observer = new MutationObserver(() => {
    if (hasLoginForm()) {
      observer.disconnect();
      run();
    }
  });

  const start = (): void => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), OBSERVE_TIMEOUT_MS);
  };

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
}
