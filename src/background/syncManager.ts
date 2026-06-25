/**
 * Pull-based policy sync skeleton.
 *
 * Per spec, kiba.crx never opens a WebSocket. Policy updates are *pulled* from
 * a static URL on a schedule (chrome.alarms), on startup, and on network
 * recovery. The fetched payload is an encrypted policy JSON decrypted with a
 * customer-managed key (BYOK) via crypto.subtle.
 *
 * This OSS build ships without a configured endpoint, so the manager is a
 * no-op skeleton: it keeps the local default policy and leaves the real
 * fetch/decrypt path as TODOs.
 */

/**
 * Static policy endpoint. Null in the OSS build — when null, syncing is a
 * no-op and the locally stored defaults remain authoritative.
 */
const POLICY_URL: string | null = null;

/** chrome.alarms name used to schedule periodic policy pulls. */
const SYNC_ALARM = 'kiba:sync';

/** Sync interval in minutes. */
const SYNC_PERIOD_MINUTES = 30;

/**
 * Pulls and applies the remote policy. Immediately returns when no endpoint is
 * configured (OSS fallback to local defaults).
 */
export async function syncPolicy(): Promise<void> {
  if (POLICY_URL === null) return;

  // TODO: fetch encrypted policy payload from POLICY_URL.
  // const res = await fetch(POLICY_URL, { cache: 'no-store' });
  // const ciphertext = await res.arrayBuffer();

  // TODO: decrypt with crypto.subtle (BYOK) using a customer-managed key,
  // e.g. crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext).

  // TODO: validate and merge the decrypted policy into chrome.storage.local
  // via setSettings(), then refresh dependent alarms.
}

/**
 * Registers the sync alarm, runs an initial sync, and wires network-recovery
 * triggers. Safe to call once at service-worker startup.
 */
export function initSyncManager(): void {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    void syncPolicy();
  });

  // Trigger a pull on startup and whenever connectivity returns.
  void syncPolicy();
  self.addEventListener('online', () => {
    void syncPolicy();
  });
}
