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
 * One-Time Bypass の付与レコード。承認エンジン（コンソール、または未設定時の
 * ローカル即時承認）が発行する。状態遷移:
 *   null ─(承認)→ {remainingUses:1} ─(消費)→ null
 *   expiresAt < now でアクセスした場合は失効として null 扱い
 */
export interface BypassGrant {
  /** 承認 ID（コンソール承認時はサーバ発番、ローカル承認時は UUID）。 */
  id: string;
  /** この付与が有効なホスト名。 */
  domain: string;
  /** 発行時刻（epoch ms）。 */
  grantedAt: number;
  /** 失効時刻（epoch ms）。TTL。 */
  expiresAt: number;
  /** 残り使用回数（単回付与なら 1）。消費でデクリメント。 */
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
   * SSO/OIDC（SAML/OIDC IdP）で取得した ID トークン（JWT）。属性ベース仕分けの
   * claims（email / groups）の供給源。未認証時は null。
   * 署名検証は IdP 側／別レイヤーの責務で、ここでは仕分け用に payload のみ参照する。
   */
  idToken: string | null;
}
