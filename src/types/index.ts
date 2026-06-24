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
  | 'tenant-block';

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
 * A shared-account credential used for the pseudo-SSO autofill demo.
 *
 * NOTE (production requirement): the spec mandates that real credentials are
 * NEVER persisted in plaintext and only ever held in a memory-resident JS
 * variable fetched from the admin console. For this MVP demo we store mock
 * credentials in chrome.storage.local so the popup can manage them; a
 * production build must replace this with a secure background-mediated fetch.
 */
export interface SsoCredential {
  /** Substring matched against the page URL, e.g. "github.com/login". */
  urlMatch: string;
  /** Account username/email to inject. */
  username: string;
  /** Account password to inject (mock value in the MVP). */
  password: string;
  /** When true, the form is submitted immediately after filling. */
  autoSubmit: boolean;
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/** The complete local policy/configuration state persisted in chrome.storage.local. */
export interface KibaSettings {
  /** When true, the content script inspects and blocks dangerous pastes. */
  antiClickFixEnabled: boolean;
  /**
   * MVP "One-Time Permission" simulation token. When true, the next file
   * upload on a restricted domain is allowed and the token is consumed.
   */
  oneTimeBypassActive: boolean;
  /**
   * When true, on restricted (foreign-tenant) contexts pastes containing
   * confidential data are sanitized (masked) instead of passing through.
   */
  maskEnabled: boolean;
  /** When true, the pseudo-SSO autofill handler is active. */
  ssoEnabled: boolean;
  /** Trusted in-house tenants used to decide foreign-tenant restriction. */
  tenantWhitelist: TenantWhitelistEntry[];
  /** Mock shared-account credentials for the pseudo-SSO demo. */
  ssoCredentials: SsoCredential[];
  /** Rolling list of recent local security events (newest first). */
  auditLog: AuditLogEntry[];
}

/** Default settings applied on install and used as a fallback when reading storage. */
export const DEFAULT_SETTINGS: KibaSettings = {
  antiClickFixEnabled: true,
  oneTimeBypassActive: false,
  maskEnabled: true,
  ssoEnabled: false,
  tenantWhitelist: [
    { provider: 'slack', tenantId: 'T0ZENPRAX', label: 'Zenprax Slack' },
    { provider: 'google', tenantId: 'zenprax.com:0', label: 'Zenprax Workspace' },
    { provider: 'github', tenantId: 'zenprax', label: 'Zenprax GitHub Org' },
  ],
  ssoCredentials: [
    {
      urlMatch: 'github.com/login',
      username: 'kiba-demo@zenprax.com',
      password: 'demo-shared-secret',
      autoSubmit: false,
    },
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
