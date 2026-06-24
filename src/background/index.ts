/**
 * kiba.crx background service worker (Manifest V3).
 *
 * Responsibilities:
 *  - Seed default settings on install.
 *  - Surface OS-level notifications on behalf of the content script (the
 *    content script runs in the isolated world and cannot call
 *    chrome.notifications directly).
 */

import { DEFAULT_SETTINGS } from '../types';
import { getSettings, setSettings } from '../lib/storage';

/** Message contract between content script and background. */
interface NotifyMessage {
  kind: 'kiba:notify';
  title: string;
  message: string;
}

type KibaMessage = NotifyMessage;

chrome.runtime.onInstalled.addListener(async () => {
  // Merge defaults in without clobbering any settings from a previous install.
  const current = await getSettings();
  await setSettings({ ...DEFAULT_SETTINGS, ...current });
});

chrome.runtime.onMessage.addListener((message: KibaMessage) => {
  if (message?.kind === 'kiba:notify') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: message.title,
      message: message.message,
      priority: 1,
    });
  }
  // No async response needed.
  return false;
});
