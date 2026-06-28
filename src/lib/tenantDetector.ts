/**
 * Feature A: context-based tenant identification.
 *
 * Rather than blocking whole domains, kiba.crx identifies *which tenant/account*
 * within a SaaS the user is currently in, and gates data egress (upload/paste)
 * when that tenant is not on the in-house ("自社公式") whitelist.
 *
 * This module is intentionally free of DOM/Chrome dependencies (it only parses
 * a URL string) so it can be unit-tested in isolation (see tenantDetector.test.ts).
 * Shared types live in ../types to keep the `lib -> types` dependency direction.
 */

import type { TenantProvider, TenantRuleDef, TenantWhitelistEntry } from '../types';
import { detectTenantByRules } from './tenantRules';

/** Result of identifying the tenant context for a given URL. */
export interface TenantContext {
  /** Detected SaaS provider, or 'unknown' when no rule matched. */
  provider: TenantProvider;
  /** Provider-specific tenant/account id, or null when it could not be extracted. */
  tenantId: string | null;
  /** Hostname of the URL (empty string for unparseable input). */
  hostname: string;
}

/**
 * Slack: extract the workspace id from `/client/{TXXXXXX}/{CXXXXXX}`.
 * The workspace id begins with `T` followed by alphanumerics.
 */
export function extractSlackWorkspace(pathname: string): string | null {
  const match = pathname.match(/\/client\/(T[A-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Google Workspace: derive an account context from the multi-login path
 * (`/u/{N}/`) combined with the host domain, e.g. `mail.google.com` + `/u/0/`
 * yields `google.com:0`. Returns null when no account index is present.
 */
export function extractGoogleAccount(pathname: string, hostname: string): string | null {
  const match = pathname.match(/\/u\/(\d+)\//);
  if (!match) return null;
  // Normalise to the registrable-ish domain so subdomains map to one tenant.
  const parts = hostname.split('.');
  const root = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
  return `${root}:${match[1]}`;
}

/**
 * GitHub: extract the org/enterprise context. Recognises `/orgs/{org}`,
 * `/enterprises/{ent}`, and falls back to the first path segment (treated as
 * the owner of a repo/profile, e.g. `/zenprax/repo`).
 */
export function extractGithubOrg(pathname: string): string | null {
  const orgs = pathname.match(/\/orgs\/([^/]+)/);
  if (orgs) return orgs[1];
  const ent = pathname.match(/\/enterprises\/([^/]+)/);
  if (ent) return ent[1];

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  // Skip reserved GitHub routes that are not owners.
  const reserved = new Set(['login', 'logout', 'join', 'settings', 'notifications', 'search']);
  const first = segments[0];
  return reserved.has(first.toLowerCase()) ? null : first;
}

/**
 * Identifies the tenant context for a URL string. Never throws: invalid input
 * yields `{ provider: 'unknown', tenantId: null, hostname: '' }`.
 *
 * When `rules` (OTA-distributed tenant-extraction rules) are passed, they are
 * evaluated first, and if any matches (provider !== 'unknown') that result is
 * returned. When none match, it falls back to the existing built-in
 * Slack/Google/GitHub detection (backward compatible).
 */
export function detectTenant(url: string, rules?: TenantRuleDef[]): TenantContext {
  if (rules && rules.length > 0) {
    const byRule = detectTenantByRules(url, rules);
    if (byRule.provider !== 'unknown') return byRule;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { provider: 'unknown', tenantId: null, hostname: '' };
  }

  const hostname = parsed.hostname;
  const pathname = parsed.pathname;

  if (hostname === 'app.slack.com' || hostname.endsWith('.slack.com')) {
    return { provider: 'slack', tenantId: extractSlackWorkspace(pathname), hostname };
  }

  if (hostname.endsWith('google.com')) {
    return { provider: 'google', tenantId: extractGoogleAccount(pathname, hostname), hostname };
  }

  if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
    return { provider: 'github', tenantId: extractGithubOrg(pathname), hostname };
  }

  return { provider: 'unknown', tenantId: null, hostname };
}

/**
 * Returns true when the detected tenant is trusted (in-house).
 *
 * Decision rules:
 *  - provider 'unknown': not decided here — callers fall back to host-based
 *    domain whitelisting. We return `true` so this function does not, on its
 *    own, restrict unknown providers.
 *  - provider known but tenantId is null (could not extract): treated as
 *    restricted (return false) — fail safe.
 *  - provider known with a tenantId: trusted iff a whitelist entry matches
 *    both provider and tenantId.
 */
export function isTrustedTenant(ctx: TenantContext, whitelist: TenantWhitelistEntry[]): boolean {
  if (ctx.provider === 'unknown') return true;
  if (ctx.tenantId === null) return false;
  return whitelist.some(
    (entry) => entry.provider === ctx.provider && entry.tenantId === ctx.tenantId,
  );
}
