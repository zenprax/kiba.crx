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
 * Returns true when the supplied text looks like an OS command that should not
 * be pasted (i.e. a likely ClickFix payload).
 */
export function isDangerousPaste(text: string): boolean {
  if (!text) return false;
  return DANGER_PATTERN.test(text);
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
 */
export function sanitizePaste(text: string): SanitizeResult {
  if (!text) return { sanitized: text, masked: false, matchedLabels: [] };

  let sanitized = text;
  const matchedLabels: string[] = [];

  for (const { label, pattern } of SECRET_PATTERNS) {
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
