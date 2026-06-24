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
