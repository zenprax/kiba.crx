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
