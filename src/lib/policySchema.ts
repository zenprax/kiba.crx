/**
 * コンソールから配信された復号済みポリシー JSON の検証（DOM/Chrome 非依存）。
 *
 * 復号後の `unknown` を、安全にマージ可能な `Partial<KibaSettings>` へ絞り込む。
 * 検証は Zod による宣言的スキーマで行い、`any` は使わない。不正な構造は丸ごと
 * 破棄（null を返し、呼び出し側はローカル既定を維持する）。
 *
 * 重要: 資格情報（ssoCredentials は別経路＝credentialBroker）とローカル専有の
 * auditLog はマージ対象から除外する。コンソールが誤って送っても取り込まない。
 * スキーマにこれらのキーを定義しないため、Zod のデフォルト（未知キーは strip）で
 * 自動的に落ちる。
 */

import { z } from 'zod';
import type { KibaAuthState, KibaSettings, TenantRuleDef, TenantWhitelistEntry } from '../types';

/**
 * 信頼できない RegExp ソース文字列の上限（ReDoS 緩和の一次防衛）。
 * 実体化時には別途 patternCompiler が構造検証する。ここは粗いゲートのみ。
 */
const MAX_PATTERN_LEN = 512;
/** OTA で配信できるカスタムパターン件数の上限（種別ごと）。 */
const MAX_CUSTOM_PATTERNS = 64;
/** OTA で配信できるテナントルール件数の上限。 */
const MAX_TENANT_RULES = 128;

const patternSourceSchema = z.string().min(1).max(MAX_PATTERN_LEN);

/**
 * ポリシーパッチ。KibaSettings の浅い部分集合だが、auth だけは部分更新を許すため
 * Partial<KibaAuthState> として表現する（呼び出し側で既存 auth と合成する）。
 */
export type PolicyPatch = Partial<Omit<KibaSettings, 'auth'>> & {
  auth?: Partial<KibaAuthState>;
};

/* ------------------------------------------------------------------ *
 * Zod スキーマ定義
 *
 * 型の真実源は src/types/index.ts の interface。ここではそれらを「検証する」
 * ためのスキーマのみを定義し、二重管理を避けるため z.infer での型再生成は
 * しない（各スキーマはトップレベル interface のサブセットと構造的に一致する）。
 * ------------------------------------------------------------------ */

const tenantProviderSchema = z.enum(['slack', 'google', 'github', 'unknown']);
const kibaModeSchema = z.enum(['ENFORCE', 'DRY_RUN']);
const offlineStrategySchema = z.enum(['LOCKDOWN', 'FAIL_OPEN']);

/** テナントホワイトリスト 1 件。 */
const tenantEntrySchema = z.object({
  provider: tenantProviderSchema,
  tenantId: z.string(),
  label: z.string(),
}) satisfies z.ZodType<TenantWhitelistEntry>;

/** 機能単位 DRY_RUN の上書きマップ。来た機能キーのみ採用する。 */
const featureModesSchema = z
  .object({
    paste: kibaModeSchema.optional(),
    file: kibaModeSchema.optional(),
    tenant: kibaModeSchema.optional(),
    download: kibaModeSchema.optional(),
  })
  .strip();

/**
 * OTA 配信のカスタムパターン群。RegExp ソースは長さ・件数を上限化する
 * （ReDoS 緩和の一次防衛。構造検証は実体化時の patternCompiler が担う）。
 */
const customPatternsSchema = z
  .object({
    danger: z.array(patternSourceSchema).max(MAX_CUSTOM_PATTERNS).optional(),
    secrets: z
      .array(z.object({ label: z.string().min(1), pattern: patternSourceSchema }))
      .max(MAX_CUSTOM_PATTERNS)
      .optional(),
  })
  .strip();

/** OTA 配信のテナント抽出ルール 1 件。 */
const tenantRuleSchema = z.object({
  provider: z.string().min(1),
  hostMatch: z.string().min(1),
  extract: z.object({
    source: z.enum(['pathname', 'hostname']),
    regex: patternSourceSchema,
    group: z.number().int().nonnegative(),
  }),
}) satisfies z.ZodType<TenantRuleDef>;

/**
 * auth の部分更新スキーマ。来たサブフィールド（offlineStrategy / ssoTtlExpiresAt）
 * のみを採用する。idToken はコンソール経由では受け取らない（ここに定義しない）。
 */
const authPatchSchema = z
  .object({
    offlineStrategy: offlineStrategySchema.optional(),
    ssoTtlExpiresAt: z.number().nullable().optional(),
  })
  .strip();

/**
 * トップレベルの各フィールド（auth を除く）の検証スキーマ。フィールド単位で
 * safeParse することで、1 フィールドの型不一致が他フィールドの採用を妨げない
 * という旧 `typeof` ガードのパッチ意味論を再現する。
 *
 * tenantWhitelist は配列全体を 1 スキーマで検証するため、1 件でも不正なら
 * フィールドごと失敗扱いとなり結果から落ちる（= 旧 every() と同値）。
 */
const fieldSchemas = {
  antiClickFixEnabled: z.boolean(),
  maskEnabled: z.boolean(),
  ssoEnabled: z.boolean(),
  auditExtensionsEnabled: z.boolean(),
  mode: kibaModeSchema,
  tenantWhitelist: z.array(tenantEntrySchema),
  networkFilterEnabled: z.boolean(),
  // --- 拡張機能群が OTA 配信する新フィールド（基盤ブランチで一括登録） ---
  featureModes: featureModesSchema,
  customPatterns: customPatternsSchema,
  tenantRules: z.array(tenantRuleSchema).max(MAX_TENANT_RULES),
  downloadGaterEnabled: z.boolean(),
  downloadAllowlist: z.array(z.string()),
  screenShareAuditEnabled: z.boolean(),
} as const;

/** undefined の値を持つキーを取り除いた浅いコピーを返す。 */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/**
 * 復号済みポリシーペイロードを検証し、マージ可能なパッチを返す。構造自体が不正
 * （オブジェクトでない等）なら null を返す。個々のフィールドは型が合致したものだけ
 * を採用し、合致しないフィールドは黙って捨てる（フェイルセーフ）。
 */
export function parsePolicyPayload(raw: unknown): PolicyPatch | null {
  // 全体のパースは緩く: トップが非オブジェクトなら null、それ以外は各フィールドを
  // 個別に safeParse して「通ったものだけ」採用する。これにより 1 フィールドの
  // 型不一致で全体を捨てる事故を避けつつ、旧実装の挙動を再現する。
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const source = raw as Record<string, unknown>;
  const patch: PolicyPatch = {};

  // フィールドごとに schema で検証し、型が合致したものだけ採用する。
  for (const [key, schema] of Object.entries(fieldSchemas)) {
    if (!(key in source)) continue;
    const result = schema.safeParse(source[key]);
    if (result.success) {
      // key は fieldSchemas のキーなので PolicyPatch の対応プロパティと一致する。
      (patch as Record<string, unknown>)[key] = result.data;
    }
  }

  // auth は部分更新。来た有効サブフィールドのみを採用し、0 件なら含めない。
  if ('auth' in source) {
    const result = authPatchSchema.safeParse(source.auth);
    if (result.success) {
      const auth = pruneUndefined(result.data);
      if (Object.keys(auth).length > 0) patch.auth = auth;
    }
  }

  return patch;
}
