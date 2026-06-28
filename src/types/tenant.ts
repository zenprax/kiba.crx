/**
 * Tenant-context identification domain types (Feature A).
 *
 * kiba.crx distinguishes in-house (official company) tenants from foreign tenants
 * on known SaaS providers to decide paste-masking and blocking.
 */

/** SaaS providers for which kiba.crx can identify a tenant/account context. */
export type TenantProvider = 'slack' | 'google' | 'github' | 'unknown';

/**
 * A single trusted (in-house/official company) tenant entry. A page whose
 * detected tenant id matches one of these (for the same provider) is treated
 * as in-house; any other tenant on a known provider is treated as foreign.
 */
export interface TenantWhitelistEntry {
  /** SaaS provider this entry applies to. */
  provider: TenantProvider;
  /** Provider-specific tenant id, e.g. a Slack workspace id `T0XXXXXXX`. */
  tenantId: string;
  /** Human-readable label shown in the popup. */
  label: string;
}

/**
 * Pluggable tenant extraction rule distributable from policy. Extends built-in
 * Slack/Google/GitHub detection to support new SaaS providers without rebuild.
 *
 * Security: `extract.regex` is an untrusted string, so it must always be
 * validated (via patternCompiler or equivalent) before creating a RegExp
 * (raw new RegExp forbidden).
 */
export interface TenantRuleDef {
  /** Provider identifier (e.g. 'slack'). Loosely extends built-in TenantProvider. */
  provider: string;
  /** Target hostname match condition (e.g. 'app.slack.com' / '*.slack.com'). */
  hostMatch: string;
  /** Specifies where and how to extract tenantId. */
  extract: {
    /** Extraction source: URL pathname or hostname. */
    source: 'pathname' | 'hostname';
    /** Regex string for extraction (untrusted; must be validated). */
    regex: string;
    /** Capture group number to use. */
    group: number;
  };
}

/**
 * Hostnames that are always trusted for file uploads in the MVP. Used as a
 * fallback when the tenant provider cannot be identified (provider 'unknown').
 */
export const WHITELISTED_DOMAINS = ['zenprax.com', 'github.com'];
