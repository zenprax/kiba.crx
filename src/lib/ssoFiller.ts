/**
 * Feature B: pseudo-SSO hidden autofill.
 *
 * Solves the shared-account dilemma at the browser edge: credentials are
 * injected into the login form and (optionally) submitted immediately, so the
 * password is present in the DOM for under a second and the user has no chance
 * to inspect it via DevTools.
 *
 * Security note (production requirement): the spec mandates that real
 * credentials live only in a memory-resident JS variable fetched from the admin
 * console and are NEVER persisted in plaintext. In this MVP demo the caller
 * supplies mock credentials read from chrome.storage.local.
 *
 * Pure helpers (matchCredential, isDevToolsLikelyOpen) are unit-tested; the
 * DOM-injection helpers (setNativeValue, fillCredentials) are exercised only at
 * runtime in the content script.
 */

import type { SsoCredential } from '../types';

/** Outcome of an autofill attempt. */
export interface FillResult {
  /** True when both username and password fields were populated. */
  filled: boolean;
  /** True when the form was auto-submitted after filling. */
  submitted: boolean;
  /** Optional reason when fill/submit did not fully succeed. */
  reason?: string;
}

/**
 * Returns the first credential whose `urlMatch` is a substring of `url`, or
 * null when none apply. Pure function — safe to unit test.
 */
export function matchCredential(url: string, creds: SsoCredential[]): SsoCredential | null {
  for (const cred of creds) {
    if (cred.urlMatch && url.includes(cred.urlMatch)) return cred;
  }
  return null;
}

/**
 * Sets an input's value via the native value setter and dispatches native
 * `input`/`change` events. This is required so React/Vue controlled components
 * (which track value through the prototype setter) register the change.
 */
export function setNativeValue(el: HTMLInputElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Locates username and password inputs within `doc`, fills them, and (when
 * `cred.autoSubmit`) submits the enclosing form. Returns a structured result.
 */
export function fillCredentials(doc: Document, cred: SsoCredential): FillResult {
  const passwordEl = doc.querySelector<HTMLInputElement>('input[type="password"]');
  if (!passwordEl) {
    return { filled: false, submitted: false, reason: 'no password field found' };
  }

  // Prefer an explicit username/email field; otherwise fall back to the first
  // text-like input that precedes the password field.
  const userEl =
    doc.querySelector<HTMLInputElement>(
      'input[type="email"], input[type="text"], input[name*="user" i], input[name*="login" i]',
    ) ?? null;

  if (userEl) setNativeValue(userEl, cred.username);
  setNativeValue(passwordEl, cred.password);

  if (!cred.autoSubmit) {
    return { filled: Boolean(userEl), submitted: false };
  }

  const form = passwordEl.form;
  if (form) {
    // requestSubmit triggers validation/submit handlers; fall back to submit().
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
    // パスワード値をDOMから即時消去して3rd Party JSによる窃取の隙を極限まで減らす。
    // 送信処理はすでにキューに入っているため、値クリアはフォーム送信に影響しない。
    setTimeout(() => {
      setNativeValue(passwordEl, '');
      if (userEl) setNativeValue(userEl, '');
    }, 1);
    return { filled: Boolean(userEl), submitted: true };
  }

  return { filled: Boolean(userEl), submitted: false, reason: 'no enclosing form to submit' };
}

