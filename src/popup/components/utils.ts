/**
 * Shared, non-component helpers for popup UI primitives.
 *
 * Kept out of any `.tsx` component module so that React Fast Refresh never sees
 * a file exporting both a component and a plain value.
 */

import type { AuditEventType } from '../../types';

/** Formats an epoch-ms timestamp as a short relative label (Japanese). */
export function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  return `${Math.floor(diff / 3600)}時間前`;
}

/** Short uppercase tag shown for each audit-event type in the feed/header. */
export const EVENT_TAG: Record<AuditEventType, string> = {
  'paste-block': 'PASTE',
  'file-block': 'FILE',
  'bypass-grant': 'BYPASS',
  'paste-mask': 'MASK',
  'sso-fill': 'SSO',
  'tenant-block': 'TENANT',
  'extension-audit': 'EXT',
  'download-block': 'DL',
  'screen-share': 'SCREEN',
};
