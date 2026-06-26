/**
 * kiba.crx background service worker (Manifest V3).
 *
 * Responsibilities:
 *  - Seed default settings on install / purge legacy plaintext credentials.
 *  - Surface OS-level notifications on behalf of the content script.
 *  - Mediate the trust boundary: SSO credential brokering and One-Time Bypass
 *    approval are handled here, never in content/popup.
 */

import { DEFAULT_SETTINGS } from '../types';
import {
  getSettings,
  purgeLegacyCredentials,
  setSettings,
} from '../lib/storage';
import { initAuditor, scanExtensions } from './auditor';
import { initSyncManager, syncManagedPolicy } from './syncManager';
import { initAuthHandler } from './authHandler';
import {
  getCredentialCount,
  getCredentialFor,
  initCredentialBroker,
} from './credentialBroker';
import { initBypassManager, requestBypass } from './bypassManager';
import { CONSOLE_CONFIG } from '../lib/consoleClient';

/** content → background: OS 通知の依頼。 */
interface NotifyMessage {
  kind: 'kiba:notify';
  title: string;
  message: string;
}

/** content → background: この URL 用の SSO 資格情報を要求（応答: SsoCredential | null）。 */
interface GetCredentialMessage {
  kind: 'kiba:get-credential';
  url: string;
}

/** content/popup → background: One-Time Bypass を要求（応答: BypassGrant | null）。 */
interface RequestBypassMessage {
  kind: 'kiba:request-bypass';
  domain: string;
}

/** popup → background: 資格情報の同期状態を要求（応答: { configured, count }）。 */
interface CredentialStatusMessage {
  kind: 'kiba:credential-status';
}

/** popup → background: クラウド同期設定の保存後、即時にポリシー同期を要求する。 */
interface RequestSyncMessage {
  kind: 'kiba:request-sync';
}

type KibaMessage =
  | NotifyMessage
  | GetCredentialMessage
  | RequestBypassMessage
  | CredentialStatusMessage
  | RequestSyncMessage;

chrome.runtime.onInstalled.addListener(async () => {
  // 旧バージョンが残した平文資格情報を削除する（機密がディスクに残らないよう保証）。
  await purgeLegacyCredentials();
  // Merge defaults in without clobbering any settings from a previous install.
  const current = await getSettings();
  await setSettings({ ...DEFAULT_SETTINGS, ...current });
  // Run an initial shadow-IT scan right after install/update.
  void scanExtensions();
});

chrome.runtime.onMessage.addListener(
  (message: KibaMessage, _sender, sendResponse) => {
    switch (message?.kind) {
      case 'kiba:notify':
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: message.title,
          message: message.message,
          priority: 1,
        });
        return false; // 同期・応答不要。

      case 'kiba:get-credential':
        void getSettings().then(async (settings) => {
          const cred = await getCredentialFor(message.url, settings);
          sendResponse(cred);
        });
        return true; // 非同期応答。

      case 'kiba:request-bypass':
        void requestBypass(message.domain).then((grant) => sendResponse(grant));
        return true; // 非同期応答。

      case 'kiba:credential-status':
        sendResponse({
          configured: CONSOLE_CONFIG.credentialUrl !== null,
          count: getCredentialCount(),
        });
        return false; // 同期応答。

      case 'kiba:request-sync':
        // 個人用クラウド同期設定の保存直後に即時 pull する。応答は不要。
        void syncManagedPolicy();
        return false;

      default:
        return false;
    }
  },
);

// Phase-2 background subsystems: extension auditing, pull-based policy sync,
// TTL/standalone auth, credential brokering, and bypass approval.
initAuditor();
initSyncManager();
initAuthHandler();
initCredentialBroker();
initBypassManager();
