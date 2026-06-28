/**
 * Top-level local settings: the complete policy/configuration state persisted
 * in chrome.storage.local, plus its defaults and the popup tab identifiers.
 */

import type { AuditLogEntry } from './audit';
import type { BypassGrant, KibaAuthState, KibaMode } from './auth';
import type { TenantRuleDef, TenantWhitelistEntry } from './tenant';

/** Top-level popup tab identifiers. */
export type TabId = 'dashboard' | 'filter' | 'anti-clickfix' | 'sso' | 'audit' | 'settings';

/** The complete local policy/configuration state persisted in chrome.storage.local. */
export interface KibaSettings {
  /** When true, the content script inspects and blocks dangerous pastes. */
  antiClickFixEnabled: boolean;
  /**
   * One-Time Bypass grant state. TTL-bearing record issued via the approval
   * engine. Null when no active exception.
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
  /**
   * True when under an organization's master policy. Effective flag to
   * lock down the Popup to read-only (set by compileActiveSettings).
   * False for personal use.
   */
  isManaged: boolean;
  /** TTL-backed auth/standalone state (used by the background authHandler). */
  auth: KibaAuthState;
  /** Trusted in-house tenants used to decide foreign-tenant restriction. */
  tenantWhitelist: TenantWhitelistEntry[];
  /** Rolling list of recent local security events (newest first). */
  auditLog: AuditLogEntry[];
  /** UI display language. Defaults to 'ja'. */
  language: 'ja' | 'en';
  /**
   * Global on/off switch. When false, all content-script plugins are stopped.
   * Controlled by the master toggle in the popup header.
   */
  enabled: boolean;
  /**
   * When true, the declarativeNetRequest ruleset 'ad_rules' is enabled,
   * blocking known threat/ad domains. Can be toggled by the user or managed
   * by a remote policy.
   */
  networkFilterEnabled: boolean;
  /**
   * User-defined domains to block via dynamic declarativeNetRequest rules.
   * Each entry is a plain hostname (e.g. "evil.com") without scheme or path.
   */
  userBlockDomains: string[];
  /**
   * Domains exempt from the declarativeNetRequest block rules (both static
   * ad_rules and userBlockDomains). Implemented as high-priority allow rules.
   */
  filterAllowlist: string[];
  /**
   * Tab IDs to hide from the popup navigation. Currently always empty.
   * Reserved for future conditional display logic.
   */
  hiddenTabs: TabId[];
  /**
   * Per-feature enforcement mode overrides (feature-level DRY_RUN).
   * When unspecified (or key missing for a feature), falls back to global `mode`.
   * Example: keep file in ENFORCE while only paste detection in DRY_RUN.
   */
  featureModes?: Partial<Record<'paste' | 'file' | 'tenant' | 'download', KibaMode>>;
  /**
   * OTA-distributed additional patterns (ClickFix detection & secret masking).
   * RegExp shipped as strings, always validated before materialization (untrusted).
   * When unset, only built-in patterns apply.
   */
  customPatterns?: {
    /** Array of RegExp source strings to add to dangerous command detection. */
    danger?: string[];
    /** Labeled RegExp sources to add to secret masking. */
    secrets?: { label: string; pattern: string }[];
  };
  /**
   * OTA-distributed tenant extraction rules. When unset, only built-in
   * Slack/Google/GitHub detection applies.
   */
  tenantRules?: TenantRuleDef[];
  /**
   * Enable Download Gater. Suspends downloads from unapproved domains and
   * routes them through the approval flow. Default false (consistent with
   * 'downloads' permission scope).
   */
  downloadGaterEnabled: boolean;
  /**
   * List of hostnames where Download Gater unconditionally permits downloads
   * (no scheme or path).
   */
  downloadAllowlist: string[];
  /**
   * Enable screen-sharing (getDisplayMedia) audit. Best-effort logging only;
   * does not block sharing itself. Default false.
   */
  screenShareAuditEnabled: boolean;
  /** UI color theme. Defaults to 'dark'. */
  theme: 'dark' | 'light';
}

/** Default settings applied on install and used as a fallback when reading storage. */
export const DEFAULT_SETTINGS: KibaSettings = {
  antiClickFixEnabled: true,
  oneTimeBypass: null,
  maskEnabled: true,
  ssoEnabled: false,
  mode: 'ENFORCE',
  auditExtensionsEnabled: true,
  isManaged: false,
  auth: {
    ssoTtlExpiresAt: null,
    offlineStrategy: 'FAIL_OPEN',
    idToken: null,
  },
  tenantWhitelist: [
    { provider: 'slack', tenantId: 'T0ZENPRAX', label: 'Zenprax Slack' },
    { provider: 'google', tenantId: 'zenprax.com:0', label: 'Zenprax Workspace' },
    { provider: 'github', tenantId: 'zenprax', label: 'Zenprax GitHub Org' },
  ],
  auditLog: [],
  language: 'ja',
  enabled: true,
  networkFilterEnabled: true,
  userBlockDomains: [],
  filterAllowlist: [],
  hiddenTabs: [],
  // Per-feature DRY_RUN / OTA patterns / tenant rules are omitted from defaults
  // (optional fields) because they fall back to built-in behavior when unset.
  downloadGaterEnabled: false,
  downloadAllowlist: [],
  screenShareAuditEnabled: false,
  theme: 'dark',
};
