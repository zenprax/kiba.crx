/**
 * DRY_RUN helpers (DOM-independent, unit-testable).
 *
 * In DRY_RUN mode, blocking actions (paste reject, file gate) are simulated:
 * the content modules skip preventDefault() and only emit audit-log entries.
 * Those entries are prefixed with `[DRY_RUN]` via `tagDetail` so the popup and
 * IT operators can tell a simulated block from a real one.
 */

import type { KibaSettings } from '../types';

/** Prefix applied to audit-log detail strings produced in DRY_RUN mode. */
export const DRY_RUN_PREFIX = '[DRY_RUN]';

/** Whether the current settings put the extension in simulation mode. */
export function isDryRun(settings: Pick<KibaSettings, 'mode'> | null | undefined): boolean {
  return settings?.mode === 'DRY_RUN';
}

/**
 * Tags an audit-log detail string for DRY_RUN. When `dryRun` is true the
 * `[DRY_RUN]` prefix is prepended (idempotent — it won't double-prefix);
 * otherwise the detail is returned unchanged.
 */
export function tagDetail(detail: string, dryRun: boolean): string {
  if (!dryRun) return detail;
  if (detail.startsWith(DRY_RUN_PREFIX)) return detail;
  return `${DRY_RUN_PREFIX} ${detail}`;
}
