/**
 * Feature: Download Gater (controls downloads from unapproved domains).
 *
 * Not only uploads (exfiltration) but also downloads from unapproved SaaS
 * (malware ingress, illicit data retrieval) are a risk. Detects the start via
 * chrome.downloads.onCreated and pauses downloads from unapproved domains with
 * chrome.downloads.pause. The OS notification's "Allow / Cancel" buttons resume
 * on approval and cancel on rejection.
 *
 * Under DRY_RUN (download feature mode), it does not pause and only records an
 * audit log entry.
 *
 * The pure decision functions (shouldGateDownload / extractDownloadHost) are
 * DOM/Chrome-independent and unit-testable (downloadGater.test.ts).
 */

import { isDryRun, tagDetail } from '../lib/dryRun';
import { addAuditLog, getSettings } from '../lib/storage';
import type { KibaSettings } from '../types';

/** Notification ID -> paused download ID. Referenced by the approve/reject button handlers. */
const pendingByNotification = new Map<string, number>();
/** Notification ID prefix (distinguishes these from other features' notifications). */
const NOTIF_PREFIX = 'kiba:download-gate:';

/**
 * Extracts the download's "origin hostname". Uses the first one that parses, in
 * the order finalUrl > url > referrer. Returns null if none can be parsed.
 */
export function extractDownloadHost(item: {
  finalUrl?: string;
  url?: string;
  referrer?: string;
}): string | null {
  for (const candidate of [item.finalUrl, item.url, item.referrer]) {
    if (!candidate) continue;
    try {
      return new URL(candidate).hostname;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** Whether host is on the allowlist (exact match or subdomain match). */
function isAllowedHost(host: string, allowlist: string[]): boolean {
  return allowlist.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Pure function deciding whether this download should be gated (paused/confirmed).
 *  - Download Gater disabled -> false
 *  - Unknown host -> false (allow through when there's nothing to judge = avoid false blocks)
 *  - allowlist match -> false
 *  - otherwise -> true
 */
export function shouldGateDownload(
  host: string | null,
  settings: Pick<KibaSettings, 'downloadGaterEnabled' | 'downloadAllowlist'>,
): boolean {
  if (!settings.downloadGaterEnabled) return false;
  if (!host) return false;
  if (isAllowedHost(host, settings.downloadAllowlist)) return false;
  return true;
}

async function onDownloadCreated(item: chrome.downloads.DownloadItem): Promise<void> {
  const settings = await getSettings();
  const host = extractDownloadHost(item);
  if (!shouldGateDownload(host, settings)) return;

  const hostname = host ?? 'unknown';

  // DRY_RUN: record only, without pausing. (Once per-feature DRY_RUN is merged,
  // this can be swapped to isDryRunFor(settings, 'download').)
  if (isDryRun(settings)) {
    void addAuditLog(
      'download-block',
      tagDetail(`Download from ${hostname} would be gated`, true),
      hostname,
    );
    return;
  }

  // ENFORCE: pause and prompt for confirmation.
  try {
    await chrome.downloads.pause(item.id);
  } catch {
    return; // Do nothing if it can't be paused (already completed/interrupted, etc.).
  }

  void addAuditLog(
    'download-block',
    tagDetail(`Paused download from ${hostname}`, false),
    hostname,
  );

  const notificationId = `${NOTIF_PREFIX}${item.id}`;
  pendingByNotification.set(notificationId, item.id);
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'kiba.crx — Download paused',
    message: `A download from ${hostname} was paused by policy. Allow it?`,
    priority: 2,
    buttons: [{ title: 'Allow' }, { title: 'Cancel' }],
    requireInteraction: true,
  });
}

/** Handles a notification button press. button 0 = Allow (resume), 1 = Cancel. */
async function onNotificationButton(notificationId: string, buttonIndex: number): Promise<void> {
  const downloadId = pendingByNotification.get(notificationId);
  if (downloadId === undefined) return;
  pendingByNotification.delete(notificationId);
  chrome.notifications.clear(notificationId);

  try {
    if (buttonIndex === 0) {
      await chrome.downloads.resume(downloadId);
    } else {
      await chrome.downloads.cancel(downloadId);
    }
  } catch {
    // Ignore cases such as the download already being invalidated.
  }
}

/** A click on the notification body (not a button) closes it on the safe side = treated as cancel. */
async function onNotificationClicked(notificationId: string): Promise<void> {
  if (!notificationId.startsWith(NOTIF_PREFIX)) return;
  const downloadId = pendingByNotification.get(notificationId);
  if (downloadId === undefined) return;
  pendingByNotification.delete(notificationId);
  chrome.notifications.clear(notificationId);
  try {
    await chrome.downloads.cancel(downloadId);
  } catch {
    // Ignore.
  }
}

/** Wires up the Download Gater listeners. Call once at background startup. */
export function initDownloadGater(): void {
  chrome.downloads.onCreated.addListener((item) => void onDownloadCreated(item));
  chrome.notifications.onButtonClicked.addListener(
    (notificationId, buttonIndex) => void onNotificationButton(notificationId, buttonIndex),
  );
  chrome.notifications.onClicked.addListener(
    (notificationId) => void onNotificationClicked(notificationId),
  );
}
