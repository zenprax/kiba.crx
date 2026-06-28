/**
 * One-Time Bypass approval path (centrally managed in background).
 *
 * A single-use exception for file uploads is issued by the console's approval
 * engine. When CONSOLE_CONFIG.bypassApprovalUrl is:
 *  - null : local immediate approval (fallback before the console is released).
 *  - set  : query the console for approval and receive an approval ID and TTL.
 *
 * On a successful grant in either path, it records an audit log entry and saves
 * the grant record to storage (to answer queries from content).
 */

import { CONSOLE_CONFIG } from '../lib/consoleClient';
import { makeGrant } from '../lib/bypass';
import { addAuditLog, setSettings } from '../lib/storage';
import type { BypassGrant } from '../types';

/** Default TTL used for local immediate approval (5 minutes). */
const LOCAL_BYPASS_TTL_MS = 5 * 60_000;

/** Expected shape of the console approval API response. */
interface ApprovalResponse {
  /** Approval ID (server-issued). */
  id: string;
  /** Grant lifetime (milliseconds). */
  ttlMs: number;
}

/** Type guard validating unknown as an ApprovalResponse. */
function isApprovalResponse(value: unknown): value is ApprovalResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApprovalResponse).id === 'string' &&
    typeof (value as ApprovalResponse).ttlMs === 'number'
  );
}

/**
 * Requests a One-Time Bypass for the given domain. On approval, saves the grant
 * record to storage, records an audit log entry, and returns it. Returns null on
 * denial or failure.
 */
export async function requestBypass(domain: string): Promise<BypassGrant | null> {
  const { bypassApprovalUrl } = CONSOLE_CONFIG;
  let grant: BypassGrant | null = null;

  if (bypassApprovalUrl === null) {
    // Local immediate approval (demo behavior). The approval ID is a locally generated UUID.
    grant = makeGrant(crypto.randomUUID(), domain, LOCAL_BYPASS_TTL_MS);
  } else {
    try {
      const res = await fetch(bypassApprovalUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (!isApprovalResponse(data)) return null;
      grant = makeGrant(data.id, domain, data.ttlMs);
    } catch {
      return null;
    }
  }

  await setSettings({ oneTimeBypass: grant });
  await addAuditLog('bypass-grant', `One-Time Bypass granted (${grant.id})`, domain);
  return grant;
}

/** Responds to approval-request messages from content. Delegated from onMessage in index.ts. */
export function initBypassManager(): void {
  // The actual messaging is wired up on the onMessage consolidation side in background/index.ts.
  // Here, init is kept as a place for a future state-initialization hook.
}
