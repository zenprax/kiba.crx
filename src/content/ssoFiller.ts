/**
 * Content-side controller for the pseudo-SSO autofill (Feature B).
 *
 * Watches for navigation to a configured login URL and, when the page is not
 * being inspected via DevTools, injects the shared-account credentials into the
 * login form (optionally auto-submitting to minimise DOM exposure time).
 *
 * Credentials are not retained in the content script; when needed, it queries
 * the background (credentialBroker) and receives exactly one. The password is
 * never persisted to storage and exists only in memory within this query
 * response.
 */

import { fillCredentials, type FillResult } from '../lib/ssoFiller';
import { addAuditLog } from '../lib/storage';
import { sendKibaMessage } from '../lib/messaging';
import type { KibaSettings, SsoCredential } from '../types';

/** How long to keep watching for a (possibly SPA-rendered) password field. */
const OBSERVE_TIMEOUT_MS = 8000;

/** True when the current document already exposes a password field to fill. */
function hasLoginForm(): boolean {
  return document.querySelector('input[type="password"]') !== null;
}

/**
 * Queries the background (credentialBroker) for one credential for this URL.
 *
 * sendMessage can fail while the MV3 service worker is waking from suspension.
 * Retries up to 3 times with exponential backoff to wait for the SW to finish
 * starting up.
 */
async function requestCredential(url: string): Promise<SsoCredential | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const cred = await sendKibaMessage({ kind: 'kiba:get-credential', url });
      return cred ?? null;
    } catch {
      if (attempt < 2) {
        await new Promise<void>((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  return null;
}

/**
 * Initialises the SSO handler. Reads live settings via `getSettings` so it
 * always honours the latest toggle state. Safe to call once at content-script
 * startup. The credentials themselves are fetched from the background.
 */
export async function initSsoHandler(getSettings: () => KibaSettings | null): Promise<void> {
  const settings = getSettings();
  // Only proceed when the feature is enabled.
  if (!settings || !settings.ssoEnabled) return;

  const cred = await requestCredential(window.location.href);
  if (!cred) return;

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
