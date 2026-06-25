/**
 * コンソールから配信された復号済みポリシー JSON の検証（DOM/Chrome 非依存）。
 *
 * 復号後の `unknown` を、安全にマージ可能な `Partial<KibaSettings>` へ絞り込む。
 * `any` は使わず、各フィールドを型ガードで検証する。不正な構造は丸ごと破棄
 * （null を返し、呼び出し側はローカル既定を維持する）。
 *
 * 重要: 資格情報（ssoCredentials は別経路＝credentialBroker）とローカル専有の
 * auditLog はマージ対象から除外する。コンソールが誤って送っても取り込まない。
 */

import type {
  KibaAuthState,
  KibaMode,
  KibaSettings,
  OfflineStrategy,
  TenantProvider,
  TenantWhitelistEntry,
} from '../types';

/**
 * ポリシーパッチ。KibaSettings の浅い部分集合だが、auth だけは部分更新を許すため
 * Partial<KibaAuthState> として表現する（呼び出し側で既存 auth と合成する）。
 */
export type PolicyPatch = Partial<Omit<KibaSettings, 'auth'>> & {
  auth?: Partial<KibaAuthState>;
};

/** unknown を string キーの辞書として安全に扱うための型ガード。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKibaMode(value: unknown): value is KibaMode {
  return value === 'ENFORCE' || value === 'DRY_RUN';
}

function isOfflineStrategy(value: unknown): value is OfflineStrategy {
  return value === 'LOCKDOWN' || value === 'FAIL_OPEN';
}

function isTenantProvider(value: unknown): value is TenantProvider {
  return value === 'slack' || value === 'google' || value === 'github' || value === 'unknown';
}

/** テナントホワイトリスト 1 件を検証する。 */
function parseTenantEntry(value: unknown): TenantWhitelistEntry | null {
  if (!isRecord(value)) return null;
  if (!isTenantProvider(value.provider)) return null;
  if (typeof value.tenantId !== 'string') return null;
  if (typeof value.label !== 'string') return null;
  return { provider: value.provider, tenantId: value.tenantId, label: value.label };
}

/**
 * 復号済みポリシーペイロードを検証し、マージ可能なパッチを返す。1 つも有効な
 * フィールドが無い場合も空オブジェクトではなく、構造自体が不正なら null を返す。
 */
export function parsePolicyPayload(raw: unknown): PolicyPatch | null {
  if (!isRecord(raw)) return null;

  const patch: PolicyPatch = {};

  if (typeof raw.antiClickFixEnabled === 'boolean') {
    patch.antiClickFixEnabled = raw.antiClickFixEnabled;
  }
  if (typeof raw.maskEnabled === 'boolean') {
    patch.maskEnabled = raw.maskEnabled;
  }
  if (typeof raw.ssoEnabled === 'boolean') {
    patch.ssoEnabled = raw.ssoEnabled;
  }
  if (typeof raw.auditExtensionsEnabled === 'boolean') {
    patch.auditExtensionsEnabled = raw.auditExtensionsEnabled;
  }
  if (isKibaMode(raw.mode)) {
    patch.mode = raw.mode;
  }

  if (Array.isArray(raw.tenantWhitelist)) {
    const entries = raw.tenantWhitelist.map(parseTenantEntry);
    // 1 件でも不正が混じる配列は信用せず丸ごと破棄する。
    if (entries.every((e): e is TenantWhitelistEntry => e !== null)) {
      patch.tenantWhitelist = entries;
    }
  }

  // auth は部分更新を許す（来たサブフィールドのみ含める。合成は呼び出し側）。
  if (isRecord(raw.auth)) {
    const auth: Partial<KibaAuthState> = {};
    if (isOfflineStrategy(raw.auth.offlineStrategy)) {
      auth.offlineStrategy = raw.auth.offlineStrategy;
    }
    if (raw.auth.ssoTtlExpiresAt === null || typeof raw.auth.ssoTtlExpiresAt === 'number') {
      auth.ssoTtlExpiresAt = raw.auth.ssoTtlExpiresAt;
    }
    if (Object.keys(auth).length > 0) patch.auth = auth;
  }

  return patch;
}
