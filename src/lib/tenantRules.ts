/**
 * Interprets the (pluggable) tenant-extraction rules from policy distribution.
 *
 * Extends the built-in Slack/Google/GitHub detection (tenantDetector.ts) so
 * tenant detection for new SaaS can be added without a rebuild. A rule matches
 * the URL hostname and extracts tenantId from the pathname / hostname via a
 * regular expression.
 *
 * Security: `extract.regex` is an untrusted string. Safe instantiation is
 * delegated to compileSafePattern (lib/patternCompiler), which enforces a
 * length cap, rejects dangerous structures, and swallows invalid patterns.
 *
 * DOM/Chrome-independent. Unit-testable (tenantRules.test.ts).
 */

import type { TenantContext } from './tenantDetector';
import type { TenantRuleDef } from '../types';
import { compileSafePattern } from './patternCompiler';

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

    const re = compileSafePattern(rule.extract.regex);
    if (!re) continue; // Skip dangerous/invalid rules

    const source = rule.extract.source === 'hostname' ? hostname : pathname;
    const match = source.match(re);
    const tenantId = match?.[rule.extract.group] ?? null;
    // provider is a string from the rule. TenantContext.provider accepts it loosely.
    return { provider: rule.provider as TenantContext['provider'], tenantId, hostname };
  }

  return { provider: 'unknown', tenantId: null, hostname };
}
