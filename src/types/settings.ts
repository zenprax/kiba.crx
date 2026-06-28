/**
 * Top-level local settings: the complete policy/configuration state persisted
 * in chrome.storage.local, plus its defaults and the popup tab identifiers.
 */

import type { AuditLogEntry } from './audit';
import type { BypassGrant, KibaAuthState, KibaMode } from './auth';
import type { TenantRuleDef, TenantWhitelistEntry } from './tenant';

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
  /** UI color theme. Defaults to 'dark'. */
  theme: 'dark' | 'light';
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
  theme: 'dark',
};
