/**
 * Shared type definitions used across the background service worker,
 * content script, and popup UI.
 *
 * All cross-module types live here so that the dependency direction stays
 * `lib -> types` (lib modules import these; types never imports from lib).
 */

/** Kinds of security events that kiba.crx records locally. */
export type AuditEventType =
  | 'paste-block'
  | 'file-block'
  | 'bypass-grant'
  | 'paste-mask'
  | 'sso-fill'
  | 'tenant-block'
  | 'extension-audit'
  // 未承認ドメインからのダウンロードを一時停止/ブロックした（Download Gater）。
  | 'download-block'
  // 画面共有（getDisplayMedia）の要求を監査記録した（best-effort、ブロックはしない）。
  | 'screen-share';

/** A single local audit-log entry shown in the popup dashboard. */
export interface AuditLogEntry {
  /** Epoch milliseconds when the event occurred. */
  ts: number;
  /** Category of the security event. */
  type: AuditEventType;
  /** Human-readable description, e.g. "Blocked PowerShell paste". */
  detail: string;
  /** Hostname the event occurred on. */
  domain: string;
}

/* ------------------------------------------------------------------ *
 * Feature A: tenant context identification
 * ------------------------------------------------------------------ */

/** SaaS providers for which kiba.crx can identify a tenant/account context. */
export type TenantProvider = 'slack' | 'google' | 'github' | 'unknown';

/**
 * A single trusted ("自社公式") tenant entry. A page whose detected tenant id
 * matches one of these (for the same provider) is treated as in-house; any
 * other tenant on a known provider is treated as a foreign ("他社") tenant.
 */
export interface TenantWhitelistEntry {
  /** SaaS provider this entry applies to. */
  provider: TenantProvider;
  /** Provider-specific tenant id, e.g. a Slack workspace id `T0XXXXXXX`. */
  tenantId: string;
  /** Human-readable label shown in the popup. */
  label: string;
}

/**
 * ポリシーから配信可能なテナント抽出ルール（プラガブル化）。組み込みの
 * Slack/Google/GitHub 判定を拡張し、新しい SaaS を再ビルドなしで追加できる。
 *
 * セキュリティ: `extract.regex` は信頼できない文字列なので、適用前に必ず
 * patternCompiler 相当の検証を通してから RegExp 化すること（生 new RegExp 禁止）。
 */
export interface TenantRuleDef {
  /** プロバイダ識別子（例 'slack'）。組み込みの TenantProvider を緩く拡張する。 */
  provider: string;
  /** 対象ホスト名のマッチ条件（例 'app.slack.com' / '*.slack.com'）。 */
  hostMatch: string;
  /** tenantId をどこからどう抽出するか。 */
  extract: {
    /** 抽出元。URL の pathname か hostname。 */
    source: 'pathname' | 'hostname';
    /** 抽出用の正規表現（文字列。信頼できないため要検証）。 */
    regex: string;
    /** 採用するキャプチャグループ番号。 */
    group: number;
  };
}

/* ------------------------------------------------------------------ *
 * Feature B: pseudo-SSO autofill
 * ------------------------------------------------------------------ */

/**
 * 共有アカウントの資格情報（擬似 SSO autofill 用）。
 *
 * セキュリティ要件: 実資格情報は **平文で永続化しない**。コンソールから取得し、
 * background のメモリ常駐キャッシュ（src/background/credentialBroker.ts）にのみ
 * 保持する。この型は chrome.storage には保存されず、broker と content 間の
 * メモリ上の受け渡しにのみ用いる。
 */
export interface SsoCredential {
  /** Substring matched against the page URL, e.g. "github.com/login". */
  urlMatch: string;
  /** Account username/email to inject. */
  username: string;
  /** Account password to inject. メモリ常駐のみ・storage 非永続。 */
  password: string;
  /** When true, the form is submitted immediately after filling. */
  autoSubmit: boolean;
}

/* ------------------------------------------------------------------ *
 * Operating mode & authentication / standalone state
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * One-Time Bypass（ファイルアップロードの単回例外）
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * Feature: エンタープライズ向け動的ポリシー配信（属性ベース仕分け）
 * ------------------------------------------------------------------ */

/**
 * JWT（ID トークン）の claims から、ポリシー仕分けに用いる最小サブセット。
 * IdP により claim 名は揺れるため、email / groups 以外も保持できるよう
 * インデックスシグネチャを持たせる（値は unknown で any は使わない）。
 */
export interface PolicyClaims {
  /** ユーザーのメールアドレス（仕分けの主キー）。 */
  email?: string;
  /** ユーザーの所属グループ（SAML/OIDC の groups claim）。 */
  groups?: string[];
  /** その他の claim（未使用だが保持はする）。 */
  [claim: string]: unknown;
}

/**
 * 設定パッチ。KibaSettings の浅い部分集合だが、auth だけは部分更新を許すため
 * Partial<KibaAuthState> として表現する（呼び出し側で既存 auth と合成する）。
 * policySchema.PolicyPatch / policyFilter.compileActiveSettings の共通土台。
 */
export type KibaSettingsPatch = Partial<Omit<KibaSettings, 'auth'>> & {
  auth?: Partial<KibaAuthState>;
};

/**
 * 設定をどのユーザーへ配るかのターゲット条件。emails と groups は OR で評価し、
 * いずれか 1 つでも一致すれば対象とみなす。両方未指定（空ターゲット）は「全員」。
 */
export interface PolicyTarget {
  /** 対象メールアドレスの完全一致リスト（小文字で比較）。 */
  emails?: string[];
  /** 対象グループ。claims.groups にいずれか 1 つでも含まれれば一致。 */
  groups?: string[];
}

/** ターゲット付きの設定断片。target にマッチしたユーザーにのみ value を適用する。 */
export interface TargetedItem<T> {
  /** 適用条件。 */
  target: PolicyTarget;
  /** マッチしたときに適用する値。 */
  value: T;
}

/**
 * 組織から配信される暗号化マスターポリシー（復号後の平文 JSON 形）。
 * base を全員に適用し、overrides を属性ベースで上書きしてユーザー個別の
 * 実効設定（KibaSettings の部分集合）をコンパイルする。
 */
export interface KibaMasterPolicy {
  /** スキーマ版（前方互換のための番号）。 */
  version: number;
  /** 全員に適用される基底設定（属性に依らない）。 */
  base: KibaSettingsPatch;
  /**
   * 属性ベースの上書き。配列順に評価し、マッチしたものを後勝ちでマージする
   * （配列後方の項目が優先）。
   */
  overrides?: TargetedItem<KibaSettingsPatch>[];
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/** Top-level popup tab identifiers. */
export type TabId = 'dashboard' | 'filter' | 'anti-clickfix' | 'sso' | 'audit' | 'settings';

/** The complete local policy/configuration state persisted in chrome.storage.local. */
export interface KibaSettings {
  /** When true, the content script inspects and blocks dangerous pastes. */
  antiClickFixEnabled: boolean;
  /**
   * One-Time Bypass の付与状態。承認エンジン経由で発行される TTL 付きレコード。
   * null のとき有効な例外なし。
   */
  oneTimeBypass: BypassGrant | null;
  /**
   * When true, on restricted (foreign-tenant) contexts pastes containing
   * confidential data are sanitized (masked) instead of passing through.
   */
  maskEnabled: boolean;
  /** When true, the pseudo-SSO autofill handler is active. */
  ssoEnabled: boolean;
  /**
   * Enforcement mode. In DRY_RUN, blocks are simulated and only logged so IT
   * can pilot the policy without disrupting users.
   */
  mode: KibaMode;
  /** When true, the background worker periodically audits installed extensions. */
  auditExtensionsEnabled: boolean;
  /**
   * 組織のマスターポリシー配下にあるとき true。Popup を読み取り専用にロックダウン
   * するための実効フラグ（compileActiveSettings が立てる）。個人利用時は false。
   */
  isManaged: boolean;
  /** TTL-backed auth/standalone state (used by the background authHandler). */
  auth: KibaAuthState;
  /** Trusted in-house tenants used to decide foreign-tenant restriction. */
  tenantWhitelist: TenantWhitelistEntry[];
  /** Rolling list of recent local security events (newest first). */
  auditLog: AuditLogEntry[];
  /** UI display language. Defaults to 'ja'. */
  language: 'ja' | 'en';
  /**
   * Global on/off switch. When false, all content-script plugins are stopped.
   * Controlled by the master toggle in the popup header.
   */
  enabled: boolean;
  /**
   * When true, the declarativeNetRequest ruleset 'ad_rules' is enabled,
   * blocking known threat/ad domains. Can be toggled by the user or managed
   * by a remote policy.
   */
  networkFilterEnabled: boolean;
  /**
   * User-defined domains to block via dynamic declarativeNetRequest rules.
   * Each entry is a plain hostname (e.g. "evil.com") without scheme or path.
   */
  userBlockDomains: string[];
  /**
   * Domains exempt from the declarativeNetRequest block rules (both static
   * ad_rules and userBlockDomains). Implemented as high-priority allow rules.
   */
  filterAllowlist: string[];
  /**
   * Tab IDs to hide from the popup navigation. Currently always empty.
   * Reserved for future conditional display logic.
   */
  hiddenTabs: TabId[];
  /**
   * 機能ごとの enforcement モード上書き（機能単位 DRY_RUN）。
   * 未指定（または該当機能のキーが無い）場合はグローバルな `mode` にフォールバックする。
   * 例: ファイルは ENFORCE のままペースト検知だけ DRY_RUN にしたい運用に対応。
   */
  featureModes?: Partial<Record<'paste' | 'file' | 'tenant' | 'download', KibaMode>>;
  /**
   * OTA 配信される追加パターン（ClickFix 検知・機密マスク）。RegExp は文字列で配信し、
   * 適用前に必ず検証してから実体化する（信頼しない）。未設定なら組み込みパターンのみ。
   */
  customPatterns?: {
    /** 危険コマンド検知に追加する RegExp ソース文字列の配列。 */
    danger?: string[];
    /** 機密マスクに追加するラベル付き RegExp ソース。 */
    secrets?: { label: string; pattern: string }[];
  };
  /**
   * OTA 配信されるテナント抽出ルール。未設定なら組み込みの Slack/Google/GitHub 判定のみ。
   */
  tenantRules?: TenantRuleDef[];
  /**
   * Download Gater を有効化するか。未承認ドメインからのダウンロードを一時停止して
   * 承認フローに乗せる。default false（'downloads' 権限の追加と整合）。
   */
  downloadGaterEnabled: boolean;
  /**
   * Download Gater でダウンロードを無条件許可するホスト名のリスト（scheme/path なし）。
   */
  downloadAllowlist: string[];
  /**
   * 画面共有（getDisplayMedia）の監査を有効化するか。best-effort の記録のみで
   * 共有自体はブロックしない。default false。
   */
  screenShareAuditEnabled: boolean;
}

/** Default settings applied on install and used as a fallback when reading storage. */
export const DEFAULT_SETTINGS: KibaSettings = {
  antiClickFixEnabled: true,
  oneTimeBypass: null,
  maskEnabled: true,
  ssoEnabled: false,
  mode: 'ENFORCE',
  auditExtensionsEnabled: true,
  isManaged: false,
  auth: {
    ssoTtlExpiresAt: null,
    offlineStrategy: 'FAIL_OPEN',
    idToken: null,
  },
  tenantWhitelist: [
    { provider: 'slack', tenantId: 'T0ZENPRAX', label: 'Zenprax Slack' },
    { provider: 'google', tenantId: 'zenprax.com:0', label: 'Zenprax Workspace' },
    { provider: 'github', tenantId: 'zenprax', label: 'Zenprax GitHub Org' },
  ],
  auditLog: [],
  language: 'ja',
  enabled: true,
  networkFilterEnabled: true,
  userBlockDomains: [],
  filterAllowlist: [],
  hiddenTabs: [],
  // 機能単位 DRY_RUN / OTA パターン / テナントルールは未設定なら組み込み挙動に
  // フォールバックするため default では省略する（optional フィールド）。
  downloadGaterEnabled: false,
  downloadAllowlist: [],
  screenShareAuditEnabled: false,
};

/** Maximum number of audit-log entries retained locally. */
export const MAX_AUDIT_ENTRIES = 100;

/**
 * Hostnames that are always trusted for file uploads in the MVP. Used as a
 * fallback when the tenant provider cannot be identified (provider 'unknown').
 */
export const WHITELISTED_DOMAINS = ['zenprax.com', 'github.com'];
