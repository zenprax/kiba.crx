/**
 * Attribute-based (SAML/OIDC JWT) policy filtering logic (DOM/Chrome-independent).
 *
 * In the enterprise edition, the encrypted master policy distributed by the
 * organization ({@link KibaMasterPolicy}) is dispatched per user via JWT claims
 * (email / groups), compiling the effective settings applied to that device and
 * that user.
 *
 * No external libraries are used:
 *  - JWT decoding uses only `atob` + `JSON.parse` (signature validation is the
 *    responsibility of the IdP / another layer).
 *  - Decryption uses only the native `crypto.subtle` (AES-GCM) API.
 *
 * All pure functions that never touch Chrome APIs, so it is unit-testable.
 */

import { importAesGcmKey } from './crypto';
import type { KibaMasterPolicy, KibaSettingsPatch, PolicyClaims, PolicyTarget } from '../types';

/**
 * Normalizes base64url (used in JWTs) to standard base64, then decodes via `atob`.
 * Replaces `-`->`+`, `_`->`/`, and adds `=` padding so the length is a multiple of 4.
 */
function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

/**
 * Decodes a JWT payload (the second segment) using only `atob` + `JSON.parse`.
 * Does not validate the signature (just reads claims for filtering).
 *
 * Returns null when the token is not 3 segments, the base64 is broken, the JSON
 * is invalid, etc., so the caller can fall back to empty claims.
 */
export function decodeJwtPayload(token: string): PolicyClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return null;
    }
    return payload as PolicyClaims;
  } catch {
    // Invalid base64, invalid JSON, etc. Return null as unfilterable.
    return null;
  }
}

/**
 * Determines whether claims match the target. emails and groups are evaluated
 * with OR; if any one matches, returns true. When both are unspecified (empty
 * target), it means "everyone" and returns true. Email comparison is
 * case-insensitive.
 */
export function matchTarget(target: PolicyTarget, claims: PolicyClaims): boolean {
  const hasEmails = Array.isArray(target.emails) && target.emails.length > 0;
  const hasGroups = Array.isArray(target.groups) && target.groups.length > 0;

  // Empty target matches everyone.
  if (!hasEmails && !hasGroups) return true;

  // Email match (exact match, lowercase comparison).
  if (hasEmails && typeof claims.email === 'string') {
    const claimEmail = claims.email.toLowerCase();
    if (target.emails!.some((e) => e.toLowerCase() === claimEmail)) return true;
  }

  // Group match (matches if any one is contained in claims.groups).
  if (hasGroups && Array.isArray(claims.groups)) {
    const claimGroups = claims.groups;
    if (target.groups!.some((g) => claimGroups.includes(g))) return true;
  }

  return false;
}

/**
 * Decrypts an AES-GCM encrypted binary blob and returns a {@link KibaMasterPolicy}.
 * @param buffer ArrayBuffer of the ciphertext (includes the GCM authentication tag).
 * @param rawKey Raw symmetric key bytes (BYOK).
 * @param iv     12-byte initialization vector.
 *
 * On decryption failure (wrong key, tampering, invalid IV, etc.) `crypto.subtle`
 * throws, so the caller can use that as a "do not apply invalid policy" fallback.
 */
export async function decryptPolicyBlob(
  buffer: ArrayBuffer,
  rawKey: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
): Promise<KibaMasterPolicy> {
  const key = await importAesGcmKey(rawKey);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buffer);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as KibaMasterPolicy;
}

/**
 * Filters the master policy by claims and compiles the settings patch
 * (Partial<KibaSettings>) that should apply to this device and this user.
 *
 * Evaluation order:
 *  1. Use base as the foundation (common to everyone).
 *  2. Evaluate overrides in array order, merging those whose target matches
 *     with last-wins precedence.
 *
 * Always sets `isManaged: true` (the fact of being managed) and places the
 * passed idToken in `auth.idToken`. Local-exclusive fields (auditLog /
 * oneTimeBypass) are excluded from the patch so existing local values are
 * preserved (kept via the shallow merge in setSettings).
 */
export function compileActiveSettings(
  masterPolicy: KibaMasterPolicy,
  claims: PolicyClaims,
  idToken: string,
): KibaSettingsPatch {
  // Starting from base, merge matching overrides in sequence (last-wins).
  let merged: KibaSettingsPatch = { ...masterPolicy.base };
  for (const item of masterPolicy.overrides ?? []) {
    if (matchTarget(item.target, claims)) {
      merged = { ...merged, ...item.value };
    }
  }

  // Local-exclusive fields are not adopted even if they come from the console.
  delete merged.auditLog;
  delete merged.oneTimeBypass;

  // Always set the managed flag and partially merge idToken into auth (the final
  // merge with existing auth is done by the caller = syncManager; here auth is
  // returned in partial form).
  return {
    ...merged,
    isManaged: true,
    auth: { ...(merged.auth ?? {}), idToken },
  };
}
