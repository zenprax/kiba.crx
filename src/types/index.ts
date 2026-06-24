/**
 * Shared type definitions used across the background service worker,
 * content script, and popup UI.
 */

/** Kinds of security events that kiba.crx records locally. */
export type AuditEventType = 'paste-block' | 'file-block' | 'bypass-grant';

/** A single local audit-log entry shown in the popup dashboard. */
export interface AuditLogEntry {
  /** Epoch milliseconds when the event occurred. */
  ts: number;
  /** Category of the security event. */
  type: AuditEventType;
  /** Human-readable description, e.g. "Blocked PowerShell paste". */
  detail: string;
  /** Hostname the event occurred on. */
  domain: string;
}

/** The complete local policy/configuration state persisted in chrome.storage.local. */
export interface KibaSettings {
  /** When true, the content script inspects and blocks dangerous pastes. */
  antiClickFixEnabled: boolean;
  /**
   * MVP "One-Time Permission" simulation token. When true, the next file
   * upload on a restricted domain is allowed and the token is consumed.
   */
  oneTimeBypassActive: boolean;
  /** Rolling list of recent local security events (newest first). */
  auditLog: AuditLogEntry[];
}

/** Default settings applied on install and used as a fallback when reading storage. */
export const DEFAULT_SETTINGS: KibaSettings = {
  antiClickFixEnabled: true,
  oneTimeBypassActive: false,
  auditLog: [],
};

/** Maximum number of audit-log entries retained locally. */
export const MAX_AUDIT_ENTRIES = 100;

/** Domains that are always trusted for file uploads in the MVP. */
export const WHITELISTED_DOMAINS = ['zenprax.com', 'github.com'];
