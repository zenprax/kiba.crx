/**
 * ポリシー配信のテナント抽出ルール（プラガブル化）を解釈する。
 *
 * 組み込みの Slack/Google/GitHub 判定（tenantDetector.ts）を拡張し、新しい SaaS の
 * テナント判定を再ビルドなしで追加できるようにする。ルールは URL の hostname に
 * マッチし、pathname / hostname から正規表現で tenantId を抽出する。
 *
 * セキュリティ: `extract.regex` は信頼できない文字列。ReDoS を避けるため、
 * ローカルの安全コンパイラ（compileTenantRegex）で長さ上限・危険構造拒否・無効
 * パターンの握りつぶしを行う。将来 lib/patternCompiler が main に入った後に
 * そちらへ統合してよい（重複ロジックの解消）。
 *
 * DOM/Chrome 非依存。単体テスト可能（tenantRules.test.ts）。
 */

import type { TenantContext } from './tenantDetector';
import type { TenantRuleDef } from '../types';

/** RegExp ソース文字列の最大長（ReDoS 緩和の一次防衛）。 */
export const MAX_TENANT_REGEX_LEN = 512;

const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*]/;
const ADJACENT_QUANTIFIER = /[+*?]\s*[+*]/;
const LARGE_BOUNDED_QUANTIFIER = /\{\s*\d{4,}/;

/**
 * 信頼できない RegExp ソースを検証し、安全なら RegExp を返す（拒否時は null）。
 * lib/patternCompiler.compileSafePattern と同等の防御。フラグは固定。
 */
export function compileTenantRegex(source: string): RegExp | null {
  if (typeof source !== 'string') return null;
  if (source.length === 0 || source.length > MAX_TENANT_REGEX_LEN) return null;
  if (
    NESTED_QUANTIFIER.test(source) ||
    ADJACENT_QUANTIFIER.test(source) ||
    LARGE_BOUNDED_QUANTIFIER.test(source)
  ) {
    return null;
  }
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

/**
 * hostMatch がホスト名にマッチするか。先頭ワイルドカード `*.example.com` は
 * サブドメイン（および登録ドメイン自身）にマッチする。それ以外は完全一致。
 */
export function hostMatches(hostMatch: string, hostname: string): boolean {
  if (hostMatch.startsWith('*.')) {
    const base = hostMatch.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === hostMatch;
}

/**
 * 配信ルール群で URL のテナントコンテキストを判定する。最初にマッチしたルールを
 * 採用する。ルールが無い / マッチしない場合は provider 'unknown' を返し、
 * 呼び出し側が組み込み判定にフォールバックできるようにする。決して throw しない。
 */
export function detectTenantByRules(url: string, rules: TenantRuleDef[]): TenantContext {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { provider: 'unknown', tenantId: null, hostname: '' };
  }

  const { hostname, pathname } = parsed;

  for (const rule of rules) {
    if (!hostMatches(rule.hostMatch, hostname)) continue;

    const re = compileTenantRegex(rule.extract.regex);
    if (!re) continue; // 危険/無効なルールはスキップ

    const source = rule.extract.source === 'hostname' ? hostname : pathname;
    const match = source.match(re);
    const tenantId = match?.[rule.extract.group] ?? null;
    // provider はルール由来の文字列。TenantContext.provider は緩く受ける。
    return { provider: rule.provider as TenantContext['provider'], tenantId, hostname };
  }

  return { provider: 'unknown', tenantId: null, hostname };
}
