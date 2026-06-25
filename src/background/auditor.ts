/**
 * Shadow-IT / extension auditor.
 *
 * Periodically inspects installed Chrome extensions and flags those whose name
 * or description suggests an information-exfiltration risk (generative AI,
 * translation, screenshot tooling, etc.). Findings are written to the local
 * audit log so IT operators can review them in the popup dashboard.
 */

import { getSettings, addAuditLog } from '../lib/storage';

/** chrome.alarms name used to schedule periodic extension scans. */
const AUDIT_ALARM = 'kiba:audit';

/** Scan interval in minutes. */
const AUDIT_PERIOD_MINUTES = 60;

/**
 * Heuristic risk keywords. An installed extension is flagged when its name or
 * description contains one of these substrings (case-insensitive).
 */
const RISK_KEYWORDS = [
  'ai',
  'gpt',
  'copilot',
  'chatgpt',
  'gemini',
  'claude',
  'translate',
  'grammar',
  'screenshot',
];

/** Returns the first matching risk keyword for the given text, or null. */
function matchRiskKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const keyword of RISK_KEYWORDS) {
    if (lower.includes(keyword)) return keyword;
  }
  return null;
}

/**
 * Scans installed extensions once and records audit-log entries for any that
 * match the risk heuristic. No-op when nothing is detected.
 */
export async function scanExtensions(): Promise<void> {
  const settings = await getSettings();
  if (!settings.auditExtensionsEnabled) return;

  const selfId = chrome.runtime.id;
  if (typeof chrome.management?.getAll !== 'function') return;
  const all = await chrome.management.getAll();

  for (const ext of all) {
    // Skip ourselves, disabled extensions, and non-extension items (themes/apps).
    if (ext.id === selfId) continue;
    if (!ext.enabled) continue;
    if (ext.type !== 'extension') continue;

    const haystack = `${ext.name} ${ext.description ?? ''}`;
    const reason = matchRiskKeyword(haystack);
    if (!reason) continue;

    await addAuditLog('extension-audit', `${ext.name} (${reason})`, 'chrome://extensions');
  }
}

/**
 * Registers the periodic scan alarm and wires up the onAlarm handler. Safe to
 * call once at service-worker startup.
 */
export function initAuditor(): void {
  chrome.alarms.create(AUDIT_ALARM, { periodInMinutes: AUDIT_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== AUDIT_ALARM) return;
    void scanExtensions();
  });
}
