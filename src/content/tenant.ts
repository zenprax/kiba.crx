/**
 * Tenant-context helpers for the content script (Feature A).
 *
 * Decides whether the current page is a *restricted context* — i.e. a foreign
 * (foreign) tenant on a known SaaS, or (for unknown providers) a host that is not
 * on the domain whitelist. Pure-ish: state is passed in via `settings` rather
 * than read from a module-level variable, so callers control the source.
 */

import { detectTenant, isTrustedTenant } from '../lib/tenantDetector';
import { DEFAULT_SETTINGS, WHITELISTED_DOMAINS, type KibaSettings } from '../types';

/** True when `host` is on the static domain whitelist (or a subdomain of one). */
export function isWhitelistedDomain(host: string): boolean {
  return WHITELISTED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Decides whether the current page is a restricted context for data egress.
 *
 * Tenant identification (Feature A) takes precedence: on a known provider we
 * trust only whitelisted tenant ids. When the provider is 'unknown' we fall
 * back to the legacy host-based domain whitelist so behaviour is unchanged for
 * non-SaaS sites. `settings` may be null (settings not loaded yet); the default
 * tenant whitelist is used in that case.
 */
export function isRestrictedContext(settings: KibaSettings | null): boolean {
  const ctx = detectTenant(window.location.href, settings?.tenantRules);
  const whitelist = settings?.tenantWhitelist ?? DEFAULT_SETTINGS.tenantWhitelist;

  if (ctx.provider === 'unknown') {
    // No tenant signal: defer to host-based whitelisting.
    return !isWhitelistedDomain(window.location.hostname);
  }
  return !isTrustedTenant(ctx, whitelist);
}
