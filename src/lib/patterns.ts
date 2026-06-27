/**
 * Detection signatures for the Anti-ClickFix paste sanitizer.
 *
 * ClickFix campaigns trick users into copying an OS command from a fake error
 * dialog and pasting it into a terminal or "Run" box. We scan pasted text for
 * the tell-tale shapes of those commands and block them at the edge.
 *
 * This module is intentionally free of DOM/Chrome dependencies so it can be
 * unit-tested in isolation (see patterns.test.ts).
 */

import { compileSafePattern } from './patternCompiler';
import type { KibaSettings } from '../types';

/**
 * 照合する入力テキストの上限長。OTA カスタムパターンは ReDoS を完全には排除
 * できないため、照合対象を切り詰めてワーストケース実行時間を上限化する。
 * 組み込みパターンの判定にも適用して挙動を統一する。
 */
export const MAX_SCAN_LEN = 50_000;

/**
 * RegExp catching dangerous CLI / scripting patterns frequently abused in
 * ClickFix and similar paste-injection attacks.
 *
 * Covered shapes:
 *  - Windows shells:        powershell, pwsh, cmd.exe, mshta
 *  - Download cradles:      Invoke-WebRequest, Invoke-Expression / iex(...)
 *  - Unix pipe-to-shell:    curl ... | sh, wget ... | bash
 *  - Direct shell exec:     bash -c, /bin/bash, /bin/sh
 */
export const DANGER_PATTERN =
  /(powershell|pwsh|cmd\.exe|mshta|Invoke-WebRequest|Invoke-Expression|iex\s*\(|\biex\b|curl\s+.*\|\s*(sh|bash)|wget\s+.*\|\s*(sh|bash)|bash\s+-c|\/bin\/(ba)?sh)/i;

/**
 * 有効な危険パターン群（組み込み既定 + 検証済みカスタム）を返す。
 * `customPatterns.danger` の各ソースは compileSafePattern を通し、安全と判断
 * できたものだけを追加する（拒否されたものは黙って無視＝フェイルセーフ）。
 */
export function getActiveDangerPatterns(
  settings?: Pick<KibaSettings, 'customPatterns'> | null,
): RegExp[] {
  const patterns: RegExp[] = [DANGER_PATTERN];
  for (const src of settings?.customPatterns?.danger ?? []) {
    const compiled = compileSafePattern(src, 'i');
    if (compiled) patterns.push(compiled);
  }
  return patterns;
}

/**
 * Returns true when the supplied text looks like an OS command that should not
 * be pasted (i.e. a likely ClickFix payload).
 *
 * 第 2 引数で照合に使うパターン群を渡せる（省略時は組み込み既定のみ＝後方互換）。
 * 照合対象テキストは MAX_SCAN_LEN で切り詰めて ReDoS のワーストケースを抑える。
 */
export function isDangerousPaste(text: string, patterns: RegExp[] = [DANGER_PATTERN]): boolean {
  if (!text) return false;
  const scan = text.length > MAX_SCAN_LEN ? text.slice(0, MAX_SCAN_LEN) : text;
  return patterns.some((p) => {
    // グローバルフラグ付きの場合に lastIndex の状態を持ち越さないよう防御的にリセット。
    p.lastIndex = 0;
    return p.test(scan);
  });
}

/**
 * Produces a short label describing why a paste was flagged, used in the
 * audit log (e.g. "Blocked PowerShell paste").
 */
export function describePasteThreat(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('powershell') || lower.includes('pwsh')) return 'Blocked PowerShell paste';
  if (lower.includes('cmd.exe') || lower.includes('mshta')) return 'Blocked Windows command paste';
  if (lower.includes('curl') || lower.includes('wget')) return 'Blocked curl/wget pipe-to-shell paste';
  if (lower.includes('iex') || lower.includes('invoke-expression')) return 'Blocked Invoke-Expression paste';
  if (lower.includes('bash') || lower.includes('/bin/')) return 'Blocked shell command paste';
  return 'Blocked dangerous OS command paste';
}

/* ------------------------------------------------------------------ *
 * Feature C (paste sanitization / masking)
 * ------------------------------------------------------------------ */

/** Replacement token substituted for confidential data in a restricted context. */
export const MASK_TOKEN = '[MASKED_BY_KIBA]';

/**
 * Confidential-data signatures. In a restricted (foreign-tenant) context, any
 * match is replaced with MASK_TOKEN so the paste can proceed without leaking
 * secrets. Each pattern carries the global flag for use with String.replace.
 */
export const SECRET_PATTERNS: { label: string; pattern: RegExp }[] = [
  // Japanese "My Number" (個人番号): exactly 12 digits as a standalone token.
  { label: 'My Number', pattern: /\b\d{12}\b/g },
  // Common API-key shapes: sk-/pk-/ghp_/gho_/AIza prefixes + a long body.
  { label: 'API Key', pattern: /\b(?:sk|pk|ghp|gho|AIza)[-_][A-Za-z0-9_-]{16,}\b/g },
  // Email addresses.
  { label: 'Email', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
];

/**
 * 有効な機密パターン群（組み込み既定 + 検証済みカスタム）を返す。
 * カスタム secret の RegExp ソースは compileSafePattern を 'g' フラグで実体化する
 * （sanitizePaste の replace で全置換するため）。拒否されたものは無視する。
 */
export function getActiveSecretPatterns(
  settings?: Pick<KibaSettings, 'customPatterns'> | null,
): { label: string; pattern: RegExp }[] {
  const result = [...SECRET_PATTERNS];
  for (const { label, pattern } of settings?.customPatterns?.secrets ?? []) {
    const compiled = compileSafePattern(pattern, 'g');
    if (compiled) result.push({ label, pattern: compiled });
  }
  return result;
}

/** Outcome of sanitizing a candidate paste. */
export interface SanitizeResult {
  /** Text with all confidential matches replaced by MASK_TOKEN. */
  sanitized: string;
  /** True when at least one match was masked. */
  masked: boolean;
  /** Distinct labels of the secret kinds that were masked. */
  matchedLabels: string[];
}

/**
 * Replaces confidential substrings with MASK_TOKEN. Pure function: returns the
 * original text unchanged (masked=false) when nothing matches.
 *
 * 第 2 引数で照合に使う機密パターン群を渡せる（省略時は組み込み既定のみ＝後方互換）。
 */
export function sanitizePaste(
  text: string,
  patterns: { label: string; pattern: RegExp }[] = SECRET_PATTERNS,
): SanitizeResult {
  if (!text) return { sanitized: text, masked: false, matchedLabels: [] };

  let sanitized = text;
  const matchedLabels: string[] = [];

  for (const { label, pattern } of patterns) {
    // Reset lastIndex defensively since patterns are module-level globals.
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, MASK_TOKEN);
      if (!matchedLabels.includes(label)) matchedLabels.push(label);
    }
  }

  return { sanitized, masked: matchedLabels.length > 0, matchedLabels };
}

/** Summarizes a sanitize result for the audit log (e.g. "Masked: Email, API Key"). */
export function describeMask(result: SanitizeResult): string {
  if (!result.masked) return 'No confidential data masked';
  return `Masked confidential data: ${result.matchedLabels.join(', ')}`;
}
