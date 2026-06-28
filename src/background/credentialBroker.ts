/**
 * In-memory broker for SSO credentials (background-only; the single trust boundary).
 *
 * Per spec, real credentials are **never persisted in plaintext**. Encrypted
 * credentials are fetched from the console and held only in a background memory
 * variable. In response to a query from content (kiba:get-credential), it returns
 * exactly the one entry matching the URL.
 *
 * Because an MV3 service worker stops within tens of seconds and its memory is
 * volatile, this uses a "short-lived cache + lazy fetch" approach. Even if the
 * cache is gone, it is re-fetched on the next query and the feature keeps working.
 * Credentials are never written to disk, including chrome.storage.session.
 */

import { decryptEnvelope, type EncryptedEnvelope } from '../lib/crypto';
import { CONSOLE_CONFIG, resolveKey } from '../lib/consoleClient';
import { isSsoUsable } from './authHandler';
import { matchCredential } from '../lib/ssoFiller';
import type { KibaSettings, SsoCredential } from '../types';

/** In-memory credential cache. Intentionally volatile; cleared when the worker stops. */
let credentialCache: SsoCredential[] | null = null;
/** Time the cache was fetched (epoch ms). */
let cacheFetchedAt = 0;
/** Cache lifetime (5 minutes). */
const CRED_CACHE_TTL_MS = 5 * 60_000;

/** Type guard validating unknown as an SsoCredential array. */
function isCredentialArray(value: unknown): value is SsoCredential[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c): c is SsoCredential =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as SsoCredential).urlMatch === 'string' &&
        typeof (c as SsoCredential).username === 'string' &&
        typeof (c as SsoCredential).password === 'string' &&
        typeof (c as SsoCredential).autoSubmit === 'boolean',
    )
  );
}

/** Fetches and decrypts encrypted credentials from the console into memory. Returns null on failure. */
async function fetchCredentials(): Promise<SsoCredential[] | null> {
  const { credentialUrl, keyRef } = CONSOLE_CONFIG;
  if (credentialUrl === null || keyRef === null) return null;

  try {
    const res = await fetch(credentialUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const envelope = (await res.json()) as EncryptedEnvelope;

    const key = await resolveKey(keyRef);
    const plaintext = await decryptEnvelope(envelope, key);
    const parsed: unknown = JSON.parse(plaintext);
    if (!isCredentialArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Re-fetches on cache miss or TTL expiry, and returns the current credential array. */
async function ensureCredentials(now: number): Promise<SsoCredential[] | null> {
  if (credentialCache && now - cacheFetchedAt < CRED_CACHE_TTL_MS) {
    return credentialCache;
  }
  const fresh = await fetchCredentials();
  if (fresh) {
    credentialCache = fresh;
    cacheFetchedAt = now;
  }
  return fresh;
}

/**
 * Returns the credential matching the given URL. Returns null when offline,
 * TTL-expired, or unconfigured (= no autofill = fail-safe). The password exists
 * only within this return value.
 */
export async function getCredentialFor(
  url: string,
  settings: KibaSettings,
): Promise<SsoCredential | null> {
  // Return nothing if SSO is disabled, or when offline / the auth TTL has expired.
  if (!settings.ssoEnabled) return null;
  if (!isSsoUsable(settings, { online: navigator.onLine })) return null;

  const creds = await ensureCredentials(Date.now());
  if (!creds) return null;
  return matchCredential(url, creds);
}

/** Number of credentials currently held in memory (for popup status display; excludes passwords). */
export function getCredentialCount(): number {
  return credentialCache?.length ?? 0;
}

/** Broker initialization hook (a place for future cache pre-warming, etc.). */
export function initCredentialBroker(): void {
  // Messaging is wired up on the onMessage consolidation side in background/index.ts.
}
