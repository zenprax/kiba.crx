/**
 * kiba.crx background service worker (Manifest V3).
 *
 * Responsibilities:
 *  - Seed default settings on install / purge legacy plaintext credentials.
 *  - Surface OS-level notifications on behalf of the content script.
 *  - Mediate the trust boundary: SSO credential brokering and One-Time Bypass
 *    approval are handled here, never in content/popup.
 */

import { DEFAULT_SETTINGS, type KibaMessage } from '../types';
import {
  getSettings,
  onSettingsChanged,
  purgeLegacyCredentials,
  setSettings,
} from '../lib/storage';
import { initAuditor, scanExtensions } from './auditor';
import { initSyncManager, syncManagedPolicy } from './syncManager';
import { initAuthHandler } from './authHandler';
import { getCredentialCount, getCredentialFor, initCredentialBroker } from './credentialBroker';
import { initBypassManager, requestBypass } from './bypassManager';
import { initDownloadGater } from './downloadGater';
import { buildDomainRules, DNR_DYNAMIC_RULE_LIMIT } from './domainRules';
import { CONSOLE_CONFIG } from '../lib/consoleClient';

chrome.runtime.onInstalled.addListener(async () => {
  // Remove plaintext credentials left by older versions (ensure no secrets remain on disk).
  await purgeLegacyCredentials();
  // Merge defaults in without clobbering any settings from a previous install.
  const current = await getSettings();
  await setSettings({ ...DEFAULT_SETTINGS, ...current });
  // Run an initial shadow-IT scan right after install/update.
  void scanExtensions();
});

chrome.runtime.onMessage.addListener((message: KibaMessage, _sender, sendResponse) => {
  switch (message?.kind) {
    case 'kiba:notify':
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: message.title,
        message: message.message,
        priority: 1,
      });
      return false; // Synchronous; no response needed.

    case 'kiba:get-credential':
      void getSettings().then(async (settings) => {
        const cred = await getCredentialFor(message.url, settings);
        sendResponse(cred);
      });
      return true; // Asynchronous response.

    case 'kiba:request-bypass':
      void requestBypass(message.domain).then((grant) => sendResponse(grant));
      return true; // Asynchronous response.

    case 'kiba:credential-status':
      sendResponse({
        configured: CONSOLE_CONFIG.credentialUrl !== null,
        count: getCredentialCount(),
      });
      return false; // Synchronous response.

    case 'kiba:request-sync':
      // Pull immediately right after saving personal cloud-sync settings. No response needed.
      void syncManagedPolicy();
      return false;

    default:
      return false;
  }
});

// Phase-2 background subsystems: extension auditing, pull-based policy sync,
// TTL/standalone auth, credential brokering, and bypass approval.
initAuditor();
initSyncManager();
initAuthHandler();
initCredentialBroker();
initBypassManager();
initDownloadGater();

// Sync the declarativeNetRequest 'ad_rules' ruleset state with the
// networkFilterEnabled setting on startup and on every change.
async function applyNetworkFilterState(enabled: boolean): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled
      ? { enableRulesetIds: ['ad_rules'], disableRulesetIds: [] }
      : { enableRulesetIds: [], disableRulesetIds: ['ad_rules'] },
  );
}

void getSettings().then((s) => applyNetworkFilterState(s.networkFilterEnabled));

// Sync user-defined block/allowlist domains to dynamic declarativeNetRequest rules.
async function applyDynamicDomainRules(blockDomains: string[], allowlist: string[]): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const resourceTypes: chrome.declarativeNetRequest.ResourceType[] = [
    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
    chrome.declarativeNetRequest.ResourceType.SCRIPT,
    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
    chrome.declarativeNetRequest.ResourceType.IMAGE,
  ];

  // Reserve slots for the allowlist first, then assign the remainder to blockDomains so the limit is not exceeded.
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

void getSettings().then((s) => applyDynamicDomainRules(s.userBlockDomains, s.filterAllowlist));

onSettingsChanged((s) => {
  void applyNetworkFilterState(s.networkFilterEnabled);
  void applyDynamicDomainRules(s.userBlockDomains, s.filterAllowlist);
});
