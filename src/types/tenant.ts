/**
 * Tenant-context identification domain types (Feature A).
 *
 * kiba.crx distinguishes in-house ("自社公式") tenants from foreign ("他社")
 * tenants on known SaaS providers to decide paste-masking and blocking.
 */

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

/**
 * Hostnames that are always trusted for file uploads in the MVP. Used as a
 * fallback when the tenant provider cannot be identified (provider 'unknown').
 */
export const WHITELISTED_DOMAINS = ['zenprax.com', 'github.com'];
