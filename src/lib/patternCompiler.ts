/**
 * 信頼できない RegExp ソース文字列を安全に RegExp へ実体化するゲートウェイ。
 *
 * OTA 配信されるカスタムパターン（patterns / tenantRules）は、コンソール由来で
 * あっても「信頼しない」前提で扱う。悪性／不注意な RegExp は ReDoS
 * （カタストロフィックバックトラッキング）でコンテンツスクリプトをハングさせうる。
 * JS には正規表現の実行時タイムアウトが無いため、ここでは
 *  (1) ソース長の上限、
 *  (2) ネストした量化子など既知の危険構造の静的拒否、
 *  (3) `new RegExp` の例外（無効パターン）の握りつぶし、
 * で防御する。さらに照合する側（patterns.ts）は入力テキスト長を上限カットして
 * ワーストケース実行時間を抑える。
 *
 * DOM/Chrome 非依存。単体テスト可能（patternCompiler.test.ts）。
 */

/** RegExp ソース文字列の最大長。policySchema 側でも一次ゲートしているが二重防御。 */
export const MAX_PATTERN_SOURCE_LEN = 512;

/**
 * 危険構造の簡易検出。完全な ReDoS 検出は不可能だが、実害の大きい代表的な
 * 「ネストした量化子」(`(a+)+`, `(a*)*`, `(a+)*` 等) と、量化子直後の量化子を弾く。
 * 量化子付きグループの後ろにさらに量化子が続く形を保守的に拒否する。
 */
const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*]/;
/** `a**` `a+*` のような連続量化子。 */
const ADJACENT_QUANTIFIER = /[+*?]\s*[+*]/;
/** 大きな有限量化（例 `{1000,}`）も指数/多項式爆発の温床になりうるので上限。 */
const LARGE_BOUNDED_QUANTIFIER = /\{\s*\d{4,}/;

/**
 * 信頼できない RegExp ソースを検証し、安全と判断できれば RegExp を返す。
 * 拒否した場合は null（呼び出し側は組み込み既定にフォールバックする）。
 *
 * @param source RegExp のソース文字列（フラグは含めない）
 * @param flags  固定フラグ。配信側に任意指定させない（状態破壊や挙動改変を防ぐ）
 */
export function compileSafePattern(source: string, flags = ''): RegExp | null {
  if (typeof source !== 'string') return null;
  if (source.length === 0 || source.length > MAX_PATTERN_SOURCE_LEN) return null;

  if (
    NESTED_QUANTIFIER.test(source) ||
    ADJACENT_QUANTIFIER.test(source) ||
    LARGE_BOUNDED_QUANTIFIER.test(source)
  ) {
    return null;
  }

  // eval は使わず new RegExp のみ。無効なパターンは例外 → null。
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}
