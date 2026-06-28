/**
 * Operating mode, authentication / standalone state, and One-Time Bypass types.
 */

/**
 * Enforcement mode for blocking actions.
 *  - `ENFORCE`: blocks (paste reject, file gate) are actually applied.
 *  - `DRY_RUN`: blocks are simulated — no preventDefault, only `[DRY_RUN]`
 *    audit-log entries are produced. Acts as a safe switch for IT pilots.
 */
export type KibaMode = 'ENFORCE' | 'DRY_RUN';

/**
 * What the edge does when offline AND the SSO/auth TTL has expired.
 *  - `LOCKDOWN`: block everything (fail closed).
 *  - `FAIL_OPEN`: allow everything (fail open).
 * Note: the pseudo-SSO feature is always locked the moment the edge goes
 * offline, independent of this strategy.
 */
export type OfflineStrategy = 'LOCKDOWN' | 'FAIL_OPEN';

/**
 * One-Time Bypass grant record issued by the approval engine (console or
 * local instant-approval if unconfigured). State transitions:
 *   null ─(approval)→ {remainingUses:1} ─(consumed)→ null
 *   If expiresAt < now, treat as expired (null).
 */
export interface BypassGrant {
  /** Approval ID (server-issued for console approval, UUID for local approval). */
  id: string;
  /** Hostname where this grant is valid. */
  domain: string;
  /** Time issued (epoch ms). */
  grantedAt: number;
  /** Expiry time (epoch ms). TTL. */
  expiresAt: number;
  /** Remaining uses (1 for single-use grant). Decremented on consumption. */
  remainingUses: number;
}

/** TTL-backed local auth state used for standalone (offline) behaviour. */
export interface KibaAuthState {
  /**
   * Epoch ms when the SSO/auth cache expires, or null when never
   * authenticated. The pseudo-SSO feature is only usable while online and
   * before this expiry.
   */
  ssoTtlExpiresAt: number | null;
  /** Behaviour once offline and the TTL has expired. */
  offlineStrategy: OfflineStrategy;
  /**
   * ID token (JWT) obtained via SSO/OIDC (SAML/OIDC IdP). Source of claims
   * (email / groups) for attribute-based routing. Null when unauthenticated.
   * Signature verification is the IdP's / another layer's responsibility;
   * here we only read the payload for routing.
   */
  idToken: string | null;
}
