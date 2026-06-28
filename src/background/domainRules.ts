/**
 * Pure builder for the user-defined dynamic declarativeNetRequest rules.
 *
 * Kept in its own module (free of background top-level side effects and chrome.*
 * calls beyond the rule enums) so it can be unit-tested in isolation.
 */

// Block rules use IDs starting at 10000; allow rules use IDs starting at 20000.
export const BLOCK_RULE_BASE_ID = 10000;
export const ALLOW_RULE_BASE_ID = 20000;

// Chrome の動的ルール上限（仕様上5,000）に対して安全マージンを持たせた実効上限。
export const DNR_DYNAMIC_RULE_LIMIT = 4900;

/**
 * Builds block/allow rules for the given domains. The `||${domain}` urlFilter is
 * the domain-anchor syntax: it matches the host and all its subdomains across
 * every path/scheme, unlike the loose `*${domain}*` substring match which also
 * matched unrelated URLs (e.g. `https://example.com/?q=google.com`) and failed
 * to reliably block the host.
 */
export function buildDomainRules(
  blockDomains: string[],
  allowlist: string[],
  resourceTypes: chrome.declarativeNetRequest.ResourceType[],
): chrome.declarativeNetRequest.Rule[] {
  return [
    ...blockDomains.map((domain, i) => ({
      id: BLOCK_RULE_BASE_ID + i,
      priority: 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: { urlFilter: `||${domain}`, resourceTypes },
    })),
    ...allowlist.map((domain, i) => ({
      id: ALLOW_RULE_BASE_ID + i,
      priority: 10,
      action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
      condition: { urlFilter: `||${domain}`, resourceTypes },
    })),
  ];
}
