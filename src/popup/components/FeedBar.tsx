import type { AuditEventType } from '../../types';
import { EVENT_TAG, formatRelativeTime } from './utils';

const FEED_TAG_CLASS: Partial<Record<AuditEventType, string>> = {
  'paste-block': 'feed-tag-paste',
  'paste-mask': 'feed-tag-paste',
  'tenant-block': 'feed-tag-paste',
  'sso-fill': 'feed-tag-sso',
  'bypass-grant': 'feed-tag-bypass',
  'download-block': 'feed-tag-dl',
  'screen-share': 'feed-tag-dl',
};

/** Single-line latest-event ticker shown under the header hero. */
export function FeedBar({
  entry,
}: {
  entry: { ts: number; type: AuditEventType; detail: string };
}) {
  const tag = EVENT_TAG[entry.type] ?? entry.type.toUpperCase();
  const tagClass = FEED_TAG_CLASS[entry.type] ?? 'feed-tag-default';
  return (
    <div className="feed-bar-row relative z-10 mt-zp-2 flex items-center gap-zp-2 overflow-hidden border-t border-border-default/60 pt-zp-2 pb-zp-5">
      <span className={`feed-bar-tag ${tagClass}`}>{tag}</span>
      <span className="min-w-0 flex-1 truncate text-zp-xs text-text-secondary">{entry.detail}</span>
      <span className="shrink-0 text-zp-xs text-text-muted">{formatRelativeTime(entry.ts)}</span>
    </div>
  );
}
