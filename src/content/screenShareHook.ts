/**
 * Isolated-world orchestrator for screen-share auditing.
 *
 * The main world (getDisplayMediaPatch.ts) detects getDisplayMedia calls and
 * notifies via window.postMessage. This module receives that, validates the
 * marker and origin, then records addAuditLog('screen-share', ...).
 *
 * Security: because the page can post arbitrary postMessages, an entry is
 * recorded only when all of the following hold:
 *  - event.source === window (messages from the same window only)
 *  - event.origin === window.location.origin
 *  - data.marker === SCREEN_SHARE_MARKER
 * This prevents the page from polluting the audit log with forged messages.
 * The captured information is minimized (href only; stream contents untouched).
 */

import { addAuditLog } from '../lib/storage';
import { SCREEN_SHARE_MARKER } from './mainWorld/getDisplayMediaPatch';

const HOSTNAME = window.location.hostname;

interface ScreenShareMessage {
  marker: string;
  href?: string;
}

function isScreenShareMessage(data: unknown): data is ScreenShareMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { marker?: unknown }).marker === SCREEN_SHARE_MARKER
  );
}

/**
 * Registers the postMessage listener. Returns a teardown (listener removal),
 * matching the content orchestrator's teardown contract.
 */
export function initScreenShareHook(): () => void {
  const handler = (event: MessageEvent<unknown>): void => {
    // Trust only messages from the same window and same origin.
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (!isScreenShareMessage(event.data)) return;

    void addAuditLog('screen-share', `Screen share requested on ${HOSTNAME}`, HOSTNAME);
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
