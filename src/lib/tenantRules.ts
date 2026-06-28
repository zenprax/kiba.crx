/**
 * Interprets the (pluggable) tenant-extraction rules from policy distribution.
 *
 * Extends the built-in Slack/Google/GitHub detection (tenantDetector.ts) so
 * tenant detection for new SaaS can be added without a rebuild. A rule matches
 * the URL hostname and extracts tenantId from the pathname / hostname via a
 * regular expression.
 *
 * Security: `extract.regex` is an untrusted string. To avoid ReDoS, the local
 * safe compiler (compileTenantRegex) enforces a length cap, rejects dangerous
 * structures, and swallows invalid patterns. In the future, after
 * lib/patternCompiler lands in main, this may be consolidated there (removing
 * the duplicated logic).
 *
 * DOM/Chrome-independent. Unit-testable (tenantRules.test.ts).
 */

import type { TenantContext } from './tenantDetector';
import type { TenantRuleDef } from '../types';

/** Maximum length of a RegExp source string (first-line defense to mitigate ReDoS). */
export const MAX_TENANT_REGEX_LEN = 512;

const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*]/;
const ADJACENT_QUANTIFIER = /[+*?]\s*[+*]/;
const LARGE_BOUNDED_QUANTIFIER = /\{\s*\d{4,}/;

/**
 * Validates an untrusted RegExp source and returns a RegExp if safe (null when rejected).
 * Equivalent defense to lib/patternCompiler.compileSafePattern. Flags are fixed.
 */
export function compileTenantRegex(source: string): RegExp | null {
  if (typeof source !== 'string') return null;
  if (source.length === 0 || source.length > MAX_TENANT_REGEX_LEN) return null;
  if (
    NESTED_QUANTIFIER.test(source) ||
    ADJACENT_QUANTIFIER.test(source) ||
    LARGE_BOUNDED_QUANTIFIER.test(source)
  ) {
    return null;
  }
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

/**
 * Whether hostMatch matches the hostname. A leading wildcard `*.example.com`
 * matches subdomains (and the registrable domain itself). Otherwise exact match.
 */
export function hostMatches(hostMatch: string, hostname: string): boolean {
  if (hostMatch.startsWith('*.')) {
    const base = hostMatch.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === hostMatch;
}

/**
 * Determines the tenant context of a URL using the distributed rules. Adopts the
 * first matching rule. When there are no rules / none match, returns provider
 * 'unknown' so the caller can fall back to built-in detection. Never throws.
 */
export function detectTenantByRules(url: string, rules: TenantRuleDef[]): TenantContext {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { provider: 'unknown', tenantId: null, hostname: '' };
  }

  const { hostname, pathname } = parsed;

  for (const rule of rules) {
    if (!hostMatches(rule.hostMatch, hostname)) continue;

    const re = compileTenantRegex(rule.extract.regex);
    if (!re) continue; // Skip dangerous/invalid rules

    const source = rule.extract.source === 'hostname' ? hostname : pathname;
    const match = source.match(re);
    const tenantId = match?.[rule.extract.group] ?? null;
    // provider is a string from the rule. TenantContext.provider accepts it loosely.
    return { provider: rule.provider as TenantContext['provider'], tenantId, hostname };
  }

  return { provider: 'unknown', tenantId: null, hostname };
}
