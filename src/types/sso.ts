/**
 * Pseudo-SSO autofill domain types (Feature B).
 */

/**
 * 共有アカウントの資格情報（擬似 SSO autofill 用）。
 *
 * セキュリティ要件: 実資格情報は **平文で永続化しない**。コンソールから取得し、
 * background のメモリ常駐キャッシュ（src/background/credentialBroker.ts）にのみ
 * 保持する。この型は chrome.storage には保存されず、broker と content 間の
 * メモリ上の受け渡しにのみ用いる。
 */
export interface SsoCredential {
  /** Substring matched against the page URL, e.g. "github.com/login". */
  urlMatch: string;
  /** Account username/email to inject. */
  username: string;
  /** Account password to inject. メモリ常駐のみ・storage 非永続。 */
  password: string;
  /** When true, the form is submitted immediately after filling. */
  autoSubmit: boolean;
}
