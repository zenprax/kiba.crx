/**
 * Pull-based policy sync.
 *
 * As specified, kiba.crx opens no WebSocket. Policy updates are *pulled* from a
 * static URL on a schedule (chrome.alarms), at startup, and on network recovery.
 * The fetched payload is JSON AES-GCM encrypted with a customer-managed key
 * (BYOK) and decrypted via crypto.subtle.
 *
 * Endpoints and keys are centralized in CONSOLE_CONFIG in src/lib/consoleClient.ts.
 * When unset (null) this is a no-op and the local default policy is retained.
 */

import { decryptEnvelope, decryptEnvelopeWithKey, type EncryptedEnvelope, type EnvelopePayload } from '../lib/crypto';
import { CONSOLE_CONFIG, resolveKey } from '../lib/consoleClient';
import { parsePolicyPayload } from '../lib/policySchema';
import { compileActiveSettings, decodeJwtPayload } from '../lib/policyFilter';
import { addAuditLog, flushAuditQueue, getSettings, setSettings } from '../lib/storage';
import type { KibaSettings, KibaSettingsPatch, KibaMasterPolicy, PolicyClaims } from '../types';

/** chrome.alarms name used to schedule periodic policy pulls. */
const SYNC_ALARM = 'kiba:sync';

/** Sync interval in minutes. */
const SYNC_PERIOD_MINUTES = 30;

/**
 * Base URL for fetching organization-distributed policy (policy.bin / iv.txt).
 * Fronted by kiba-api.zenprax.com through a Cloudflare proxy; the `${policyId}`
 * segment is filled with a per-tenant UUID.
 */
const POLICY_BASE_URL = 'https://kiba-api.zenprax.com/v1/users';

/**
 * Applies a validated policy patch to the current settings. `auth` is a partial
 * patch, so it is merged with the existing value before saving (setSettings does
 * a shallow merge, which would otherwise replace `auth` wholesale).
 */
async function applyPolicyPatch(patch: KibaSettingsPatch): Promise<void> {
  const { auth: authPatch, ...rest } = patch;
  const update: Partial<KibaSettings> = { ...rest };

  if (authPatch) {
    const current = await getSettings();
    update.auth = { ...current.auth, ...authPatch };
  }

  await setSettings(update);
}

/**
 * Pulls and applies the remote policy. Returns immediately when the endpoint or
 * key is unset (OSS fallback: retain local defaults). Fetch, decryption, and
 * schema-validation failures are all swallowed, keeping the local state as-is
 * (an invalid policy is never applied).
 */
export async function syncPolicy(): Promise<void> {
  const { policyUrl, keyRef } = CONSOLE_CONFIG;
  if (policyUrl === null || keyRef === null) return;

  try {
    const res = await fetch(policyUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const envelope = (await res.json()) as EncryptedEnvelope;

    const key = await resolveKey(keyRef);
    const plaintext = await decryptEnvelope(envelope, key);
    const patch = parsePolicyPayload(JSON.parse(plaintext));
    if (!patch) return;

    await applyPolicyPatch(patch);
  } catch {
    // On network/decryption/parse failure, retain the local default.
    return;
  }
}

/**
 * Resolves the policyId used for sync. Prefers the managed value deployed via
 * GPO/MDM; otherwise falls back to the local customPolicyId a personal user set
 * in the Popup. If neither exists, returns null (falling back to the existing
 * CONSOLE_CONFIG path).
 */
async function resolvePolicyId(): Promise<string | null> {
  // chrome.storage.managed can throw or be empty where no managed schema is deployed, so try/catch.
  try {
    const managed = await chrome.storage.managed.get(['policyId']);
    if (typeof managed.policyId === 'string' && managed.policyId.length > 0) {
      return managed.policyId;
    }
  } catch {
    // Environment without managed support (e.g. personal Chrome). Proceed to the local fallback.
  }

  const local = await chrome.storage.local.get('customPolicyId');
  if (typeof local.customPolicyId === 'string' && local.customPolicyId.length > 0) {
    return local.customPolicyId;
  }
  return null;
}

/**
 * Reads `decryptionKey` (Base64 or raw text) from chrome.storage.local, hashes it
 * with SHA-256, and returns a 32-byte AES-GCM key buffer.
 *
 * This safely normalizes any arbitrary user-entered string into a 256-bit key.
 * If decryptionKey is unset, returns null so the caller can skip the sync.
 */
async function resolveRawKey(): Promise<Uint8Array<ArrayBuffer> | null> {
  const local = await chrome.storage.local.get('decryptionKey');
  if (typeof local.decryptionKey !== 'string' || local.decryptionKey.length === 0) {
    return null;
  }
  // Encode the text string as UTF-8 bytes and convert it to a 32-byte key via SHA-256.
  const encoded = new TextEncoder().encode(local.decryptionKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(hashBuffer) as Uint8Array<ArrayBuffer>;
}

/**
 * Enterprise path: fetches the two-layer envelope payload (policy.json) for the
 * resolved policyId, decrypts it locally using the BYOK master key, then
 * attribute-filters by the current user's JWT claims and applies the result.
 *
 * Design notes:
 *  - Single fetch for policy.json (EnvelopePayload JSON) — no separate iv.txt.
 *  - Two-layer decryption: K_master unwraps K_data, K_data decrypts the policy.
 *  - All crypto runs locally in the extension; the server is a stateless blob store.
 *  - When policyId is absent, falls back to the CONSOLE_CONFIG path ({@link syncPolicy}).
 *  - Fetch/decryption/parse failures are all swallowed, keeping the local state as-is.
 */
export async function syncManagedPolicy(): Promise<void> {
  const policyId = await resolvePolicyId();
  if (policyId === null) {
    // No organization policy specified. Fall back to the OSS/console path.
    await syncPolicy();
    return;
  }

  // If decryptionKey is unset, do not sync (never attempt decryption in an incomplete state).
  const rawKey = await resolveRawKey();
  if (rawKey === null) return;

  try {
    const encodedId = encodeURIComponent(policyId);
    const policyJsonUrl = `${POLICY_BASE_URL}/${encodedId}/policy.json`;

    const res = await fetch(policyJsonUrl, { cache: 'no-store' });
    if (!res.ok) return;

    const payload = (await res.json()) as EnvelopePayload;

    // Two-layer decryption: K_master → K_data → plaintext. All crypto runs locally.
    const plaintext = await decryptEnvelopeWithKey(payload, rawKey);
    const masterPolicy = JSON.parse(plaintext) as KibaMasterPolicy;

    // Filter by the current user's JWT claims (auth.idToken in storage).
    const settings = await getSettings();
    const idToken = settings.auth.idToken ?? '';
    const claims: PolicyClaims = (idToken && decodeJwtPayload(idToken)) || {};

    const patch = compileActiveSettings(masterPolicy, claims, idToken);
    await applyPolicyPatch(patch);

    // Record the successful sync in the audit log.
    await addAuditLog(
      'extension-audit',
      'Policy successfully synced from Cloud',
      'kiba-api.zenprax.com',
    );
  } catch {
    // On network/decryption/parse failure, retain the local state.
    return;
  }
}

/**
 * Registers the sync alarm, runs an initial sync, and wires network-recovery
 * triggers. Safe to call once at service-worker startup.
 *
 * Startup, timer, and online-recovery all originate from {@link syncManagedPolicy}
 * (which internally selects the organization path or CONSOLE_CONFIG path based on
 * whether policyId exists).
 *
 * Note: the online event is also subscribed in authHandler (initAuthHandler);
 * here we handle only the alarm and startup sync, and consolidate the online
 * event in authHandler to avoid double-registration.
 */
export function initSyncManager(): void {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    void syncManagedPolicy();
    // Piggyback on the sync cycle to forward audit logs to the console API.
    // No-op when telemetryUrl is unset. Safe on send failure since local state is unchanged.
    if (CONSOLE_CONFIG.telemetryUrl) {
      void flushAuditQueue(CONSOLE_CONFIG.telemetryUrl);
    }
  });

  // Pull immediately at startup. The online event is handled by authHandler.
  void syncManagedPolicy();
}
