/**
 * Local audit-log domain types.
 *
 * Security events that kiba.crx records on-device and renders in the popup
 * dashboard. No cross-module dependencies — pure data shapes.
 */

/** Kinds of security events that kiba.crx records locally. */
export type AuditEventType =
  | 'paste-block'
  | 'file-block'
  | 'bypass-grant'
  | 'paste-mask'
  | 'sso-fill'
  | 'tenant-block'
  | 'extension-audit'
  // 未承認ドメインからのダウンロードを一時停止/ブロックした（Download Gater）。
  | 'download-block'
  // 画面共有（getDisplayMedia）の要求を監査記録した（best-effort、ブロックはしない）。
  | 'screen-share';

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

/** Maximum number of audit-log entries retained locally. */
export const MAX_AUDIT_ENTRIES = 100;
