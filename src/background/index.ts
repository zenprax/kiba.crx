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
import { applyNetworkFilterState, applyDynamicDomainRules } from './domainRules';
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

void getSettings().then((s) => applyNetworkFilterState(s.networkFilterEnabled));

void getSettings().then((s) => applyDynamicDomainRules(s.userBlockDomains, s.filterAllowlist));

onSettingsChanged((s) => {
  void applyNetworkFilterState(s.networkFilterEnabled);
  void applyDynamicDomainRules(s.userBlockDomains, s.filterAllowlist);
});
