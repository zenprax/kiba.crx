/**
 * Content-side controller for the pseudo-SSO autofill (Feature B).
 *
 * Watches for navigation to a configured login URL and, when the page is not
 * being inspected via DevTools, injects the shared-account credentials into the
 * login form (optionally auto-submitting to minimise DOM exposure time).
 *
 * 資格情報は content では保持せず、必要時に background（credentialBroker）へ
 * 問い合わせて 1 件だけ受け取る。password は storage に永続化されず、この
 * 問い合わせ応答のメモリ上にのみ存在する。
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
 * background（credentialBroker）へこの URL 用の資格情報を 1 件問い合わせる。
 *
 * MV3 の Service Worker がサスペンドから復帰する際に sendMessage が失敗することがある。
 * 最大3回、指数バックオフでリトライして SW の起動完了を待つ。
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
 * startup. 資格情報そのものは background から取得する。
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
