/**
 * Rule builder and DNR apply helpers for user-defined dynamic
 * declarativeNetRequest rules. buildDomainRules is kept free of chrome API
 * calls (beyond enums) for unit-test isolation; applyNetworkFilterState and
 * applyDynamicDomainRules orchestrate the actual chrome.declarativeNetRequest
 * side effects.
 */

// Block rules use IDs starting at 10000; allow rules use IDs starting at 20000.
export const BLOCK_RULE_BASE_ID = 10000;
export const ALLOW_RULE_BASE_ID = 20000;

// Effective limit with a safety margin below Chrome's dynamic rule cap (5,000 per spec).
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

/**
 * Enables or disables the 'ad_rules' declarativeNetRequest ruleset based on
 * the networkFilterEnabled setting.
 */
export async function applyNetworkFilterState(enabled: boolean): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled
      ? { enableRulesetIds: ['ad_rules'], disableRulesetIds: [] }
      : { enableRulesetIds: [], disableRulesetIds: ['ad_rules'] },
  );
}

/**
 * Syncs user-defined block/allowlist domains to dynamic declarativeNetRequest
 * rules, trimming to DNR_DYNAMIC_RULE_LIMIT if needed.
 */
export async function applyDynamicDomainRules(
  blockDomains: string[],
  allowlist: string[],
): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const resourceTypes: chrome.declarativeNetRequest.ResourceType[] = [
    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
    chrome.declarativeNetRequest.ResourceType.SCRIPT,
    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
    chrome.declarativeNetRequest.ResourceType.IMAGE,
  ];

  let trimmedBlock = blockDomains;
  let trimmedAllow = allowlist;
  const total = blockDomains.length + allowlist.length;
  if (total > DNR_DYNAMIC_RULE_LIMIT) {
    const allowSlots = Math.min(allowlist.length, DNR_DYNAMIC_RULE_LIMIT);
    const blockSlots = DNR_DYNAMIC_RULE_LIMIT - allowSlots;
    trimmedAllow = allowlist.slice(0, allowSlots);
    trimmedBlock = blockDomains.slice(0, blockSlots);
    console.warn(
      `[kiba.crx] DNR rule limit: trimmed ${total - DNR_DYNAMIC_RULE_LIMIT} rules (block: ${blockDomains.length}→${trimmedBlock.length}, allow: ${allowlist.length}→${trimmedAllow.length})`,
    );
  }

  const addRules = buildDomainRules(trimmedBlock, trimmedAllow, resourceTypes);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (err) {
    console.error('[kiba.crx] Failed to update dynamic domain rules', err);
  }
}
