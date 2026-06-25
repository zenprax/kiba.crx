/**
 * Shared type definitions used across the background service worker,
 * content script, and popup UI.
 *
 * All cross-module types live here so that the dependency direction stays
 * `lib -> types` (lib modules import these; types never imports from lib).
 */

/** Kinds of security events that kiba.crx records locally. */
export type AuditEventType =
  | 'paste-block'
  | 'file-block'
  | 'bypass-grant'
  | 'paste-mask'
  | 'sso-fill'
  | 'tenant-block'
  | 'extension-audit';

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

/* ------------------------------------------------------------------ *
 * Feature A: tenant context identification
 * ------------------------------------------------------------------ */

/** SaaS providers for which kiba.crx can identify a tenant/account context. */
export type TenantProvider = 'slack' | 'google' | 'github' | 'unknown';

/**
 * A single trusted ("自社公式") tenant entry. A page whose detected tenant id
 * matches one of these (for the same provider) is treated as in-house; any
 * other tenant on a known provider is treated as a foreign ("他社") tenant.
 */
export interface TenantWhitelistEntry {
  /** SaaS provider this entry applies to. */
  provider: TenantProvider;
  /** Provider-specific tenant id, e.g. a Slack workspace id `T0XXXXXXX`. */
  tenantId: string;
  /** Human-readable label shown in the popup. */
  label: string;
}

/* ------------------------------------------------------------------ *
 * Feature B: pseudo-SSO autofill
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * Operating mode & authentication / standalone state
 * ------------------------------------------------------------------ */

/**
 * Enforcement mode for blocking actions.
 *  - `ENFORCE`: blocks (paste reject, file gate) are actually applied.
 *  - `DRY_RUN`: blocks are simulated — no preventDefault, only `[DRY_RUN]`
 *    audit-log entries are produced. Acts as a safe switch for IT pilots.
 */
export type KibaMode = 'ENFORCE' | 'DRY_RUN';

/**
 * What the edge does when offline AND the SSO/auth TTL has expired.
 *  - `LOCKDOWN`: block everything (fail closed).
 *  - `FAIL_OPEN`: allow everything (fail open).
 * Note: the pseudo-SSO feature is always locked the moment the edge goes
 * offline, independent of this strategy.
 */
export type OfflineStrategy = 'LOCKDOWN' | 'FAIL_OPEN';

/* ------------------------------------------------------------------ *
 * One-Time Bypass（ファイルアップロードの単回例外）
 * ------------------------------------------------------------------ */

/**
 * One-Time Bypass の付与レコード。承認エンジン（コンソール、または未設定時の
 * ローカル即時承認）が発行する。状態遷移:
 *   null ─(承認)→ {remainingUses:1} ─(消費)→ null
 *   expiresAt < now でアクセスした場合は失効として null 扱い
 */
export interface BypassGrant {
  /** 承認 ID（コンソール承認時はサーバ発番、ローカル承認時は UUID）。 */
  id: string;
  /** この付与が有効なホスト名。 */
  domain: string;
  /** 発行時刻（epoch ms）。 */
  grantedAt: number;
  /** 失効時刻（epoch ms）。TTL。 */
  expiresAt: number;
  /** 残り使用回数（単回付与なら 1）。消費でデクリメント。 */
  remainingUses: number;
}

/** TTL-backed local auth state used for standalone (offline) behaviour. */
export interface KibaAuthState {
  /**
   * Epoch ms when the SSO/auth cache expires, or null when never
   * authenticated. The pseudo-SSO feature is only usable while online and
   * before this expiry.
   */
  ssoTtlExpiresAt: number | null;
  /** Behaviour once offline and the TTL has expired. */
  offlineStrategy: OfflineStrategy;
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/** The complete local policy/configuration state persisted in chrome.storage.local. */
export interface KibaSettings {
  /** When true, the content script inspects and blocks dangerous pastes. */
  antiClickFixEnabled: boolean;
  /**
   * One-Time Bypass の付与状態。承認エンジン経由で発行される TTL 付きレコード。
   * null のとき有効な例外なし。
   */
  oneTimeBypass: BypassGrant | null;
  /**
   * When true, on restricted (foreign-tenant) contexts pastes containing
   * confidential data are sanitized (masked) instead of passing through.
   */
  maskEnabled: boolean;
  /** When true, the pseudo-SSO autofill handler is active. */
  ssoEnabled: boolean;
  /**
   * Enforcement mode. In DRY_RUN, blocks are simulated and only logged so IT
   * can pilot the policy without disrupting users.
   */
  mode: KibaMode;
  /** When true, the background worker periodically audits installed extensions. */
  auditExtensionsEnabled: boolean;
  /** TTL-backed auth/standalone state (used by the background authHandler). */
  auth: KibaAuthState;
  /** Trusted in-house tenants used to decide foreign-tenant restriction. */
  tenantWhitelist: TenantWhitelistEntry[];
  /** Rolling list of recent local security events (newest first). */
  auditLog: AuditLogEntry[];
}

/** Default settings applied on install and used as a fallback when reading storage. */
export const DEFAULT_SETTINGS: KibaSettings = {
  antiClickFixEnabled: true,
  oneTimeBypass: null,
  maskEnabled: true,
  ssoEnabled: false,
  mode: 'ENFORCE',
  auditExtensionsEnabled: true,
  auth: {
    ssoTtlExpiresAt: null,
    offlineStrategy: 'FAIL_OPEN',
  },
  tenantWhitelist: [
    { provider: 'slack', tenantId: 'T0ZENPRAX', label: 'Zenprax Slack' },
    { provider: 'google', tenantId: 'zenprax.com:0', label: 'Zenprax Workspace' },
    { provider: 'github', tenantId: 'zenprax', label: 'Zenprax GitHub Org' },
  ],
  auditLog: [],
};

/** Maximum number of audit-log entries retained locally. */
export const MAX_AUDIT_ENTRIES = 100;

/**
 * Hostnames that are always trusted for file uploads in the MVP. Used as a
 * fallback when the tenant provider cannot be identified (provider 'unknown').
 */
export const WHITELISTED_DOMAINS = ['zenprax.com', 'github.com'];
