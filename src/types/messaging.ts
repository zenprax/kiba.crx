/**
 * Typed runtime-messaging contract between the popup / content script and the
 * background service worker.
 *
 * {@link KibaMessageMap} is the single source of truth: each key is a message
 * `kind`, mapped to its request payload (`req`) and response shape (`res`,
 * `void` when fire-and-forget). The sender helper in `lib/messaging.ts` and the
 * background dispatcher both derive their types from this map, so adding a new
 * message means editing exactly one place.
 */

import type { BypassGrant } from './auth';
import type { SsoCredential } from './sso';

/** content → background: ask the worker to surface an OS notification. */
export interface NotifyMessage {
  kind: 'kiba:notify';
  title: string;
  message: string;
}

/** content → background: request the SSO credential for this URL. */
export interface GetCredentialMessage {
  kind: 'kiba:get-credential';
  url: string;
}

/** content / popup → background: request a One-Time Bypass for a domain. */
export interface RequestBypassMessage {
  kind: 'kiba:request-bypass';
  domain: string;
}

/** popup → background: query the credential sync status. */
export interface CredentialStatusMessage {
  kind: 'kiba:credential-status';
}

/** popup → background: pull the managed policy immediately after a sync config save. */
export interface RequestSyncMessage {
  kind: 'kiba:request-sync';
}

/**
 * Response to {@link CredentialStatusMessage}. Carries no secret material — only
 * whether credentials are configured and how many are cached.
 */
export interface CredentialStatusResponse {
  /** True when console integration has configured credentials. */
  configured: boolean;
  /** Number of credentials in the in-memory cache (never includes passwords). */
  count: number;
}

/**
 * Maps each message `kind` to its request payload and response shape. The
 * authoritative contract for {@link KibaMessage}, {@link KibaMessageKind}, and
 * the typed `sendKibaMessage` helper.
 */
export interface KibaMessageMap {
  'kiba:notify': { req: NotifyMessage; res: void };
  'kiba:get-credential': { req: GetCredentialMessage; res: SsoCredential | null };
  'kiba:request-bypass': { req: RequestBypassMessage; res: BypassGrant | null };
  'kiba:credential-status': { req: CredentialStatusMessage; res: CredentialStatusResponse };
  'kiba:request-sync': { req: RequestSyncMessage; res: void };
}

/** Every supported message `kind`. */
export type KibaMessageKind = keyof KibaMessageMap;

/** Discriminated union of every request message the background worker accepts. */
export type KibaMessage = KibaMessageMap[KibaMessageKind]['req'];

/** The response type for a given message `kind`. */
export type KibaResponse<K extends KibaMessageKind> = KibaMessageMap[K]['res'];
