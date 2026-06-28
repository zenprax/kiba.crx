/**
 * Pseudo-SSO autofill domain types (Feature B).
 */

/**
 * Shared account credentials for pseudo-SSO autofill.
 *
 * Security requirement: actual credentials are **never persisted in plaintext**.
 * Fetched from console and kept only in the background's in-memory cache
 * (src/background/credentialBroker.ts). This type is never stored to
 * chrome.storage; used only for in-memory handoff between broker and content.
 */
export interface SsoCredential {
  /** Substring matched against the page URL, e.g. "github.com/login". */
  urlMatch: string;
  /** Account username/email to inject. */
  username: string;
  /** Account password to inject. In-memory only; not persisted to storage. */
  password: string;
  /** When true, the form is submitted immediately after filling. */
  autoSubmit: boolean;
}
