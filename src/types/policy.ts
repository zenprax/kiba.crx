/**
 * Enterprise dynamic-policy distribution types (attribute-based targeting).
 *
 * An organization ships an encrypted master policy; after decryption it is
 * compiled per-user into an effective subset of {@link KibaSettings} based on
 * JWT claims (email / groups).
 */

import type { KibaAuthState } from './auth';
import type { KibaSettings } from './settings';

/**
 * Minimal subset of JWT (ID-token) claims used for policy routing.
 * Claim names vary by IdP, so an index signature preserves unknown claims
 * (typed as unknown, not any).
 */
export interface PolicyClaims {
  /** User's email address (primary routing key). */
  email?: string;
  /** Groups the user belongs to (SAML/OIDC groups claim). */
  groups?: string[];
  /** Any other claims — retained but not used for routing. */
  [claim: string]: unknown;
}

/**
 * Settings patch: a shallow subset of KibaSettings where `auth` allows
 * partial updates (callers merge it with the existing auth state).
 * Shared base for policySchema.PolicyPatch and policyFilter.compileActiveSettings.
 */
export type KibaSettingsPatch = Partial<Omit<KibaSettings, 'auth'>> & {
  auth?: Partial<KibaAuthState>;
};

/**
 * Targeting condition that decides which users receive a settings patch.
 * emails and groups are evaluated with OR logic; a single match is sufficient.
 * When both are omitted (empty target) the patch applies to everyone.
 */
export interface PolicyTarget {
  /** Exact-match email list (compared case-insensitively). */
  emails?: string[];
  /** Group list — matches if the user's claims.groups contains any entry. */
  groups?: string[];
}

/** A settings patch paired with a targeting condition. Applied only to matching users. */
export interface TargetedItem<T> {
  /** The condition that must be satisfied for this item to apply. */
  target: PolicyTarget;
  /** The value to apply when the target matches. */
  value: T;
}

/**
 * Decrypted form of the encrypted master policy distributed by the organisation.
 * `base` is applied to everyone; `overrides` are evaluated in array order and
 * merged last-wins (later entries take precedence).
 */
export interface KibaMasterPolicy {
  /** Schema version number for forward-compatibility checks. */
  version: number;
  /** Baseline settings applied to all users regardless of attributes. */
  base: KibaSettingsPatch;
  /**
   * Attribute-based overrides evaluated in order; later entries win on conflict.
   */
  overrides?: TargetedItem<KibaSettingsPatch>[];
}
