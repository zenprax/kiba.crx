/**
 * The single integration point for the (admin) console connection.
 *
 * All three features - policy sync, SSO credential retrieval, and One-Time
 * Bypass approval - operate off the backend console API. The "endpoint URLs and
 * BYOK key" needed for productionization are consolidated in this one file, so
 * that all features become operational simply by filling in `CONSOLE_CONFIG`
 * later.
 *
 * Since the console API is to be published later, everything is currently null.
 * Each null feature falls back to the safe side (sync no-op / autofill disabled
 * / immediate local approval).
 */

import { base64ToBytes, importAesGcmKey, type KeyRef } from './crypto';

/** Console connection config. When a URL/key is null, the corresponding feature falls back to the safe side. */
export interface ConsoleConfig {
  /** URL to pull the encrypted policy from. When null, sync is a no-op (keeps local defaults). */
  policyUrl: string | null;
  /** URL of the SSO credential retrieval API. When null, SSO autofill is disabled. */
  credentialUrl: string | null;
  /** URL of the One-Time Bypass approval API. When null, immediate local approval (demo behavior). */
  bypassApprovalUrl: string | null;
  /** Reference to the BYOK key. When null, features requiring an encrypted payload are disabled. */
  keyRef: KeyRef | null;
  /** URL to forward audit logs to. When null, flushing is a no-op (local retention only). */
  telemetryUrl: string | null;
}

/**
 * The single edit point for productionization. Later, simply filling in each URL
 * and keyRef of this constant makes policy sync, SSO credentials, Bypass
 * approval, and audit-log forwarding all operate via console integration.
 */
export const CONSOLE_CONFIG: ConsoleConfig = {
  policyUrl: null,
  credentialUrl: null,
  bypassApprovalUrl: null,
  keyRef: null,
  telemetryUrl: null,
};

/**
 * Resolves a KeyRef into a CryptoKey for AES-GCM.
 *  - `raw-base64`: a Base64 key embedded directly in the config (interim operation).
 *  - `storage`   : a Base64 key stored under a separate key in chrome.storage.local.
 */
export async function resolveKey(ref: KeyRef): Promise<CryptoKey> {
  if (ref.source === 'raw-base64') {
    return importAesGcmKey(base64ToBytes(ref.value));
  }
  const result = await chrome.storage.local.get(ref.storageKey);
  const value = result[ref.storageKey];
  if (typeof value !== 'string') {
    throw new Error(`BYOK key not found at storage key: ${ref.storageKey}`);
  }
  return importAesGcmKey(base64ToBytes(value));
}
