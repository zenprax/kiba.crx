/**
 * Type-safe wrapper around `chrome.runtime.sendMessage` for kiba.crx.
 *
 * The response type is inferred from the message's `kind` via
 * {@link KibaMessageMap}, so callers get a correctly-typed result without
 * casting and the compiler rejects unknown message kinds or malformed payloads.
 */

import type { KibaMessage, KibaResponse } from '../types';

/**
 * Send a message to the background service worker and resolve with its typed
 * response. For fire-and-forget messages the response type is `void`.
 * @param msg The message to send; its `kind` determines the response type.
 * @returns The background worker's response, typed per {@link KibaMessageMap}.
 */
export function sendKibaMessage<M extends KibaMessage>(msg: M): Promise<KibaResponse<M['kind']>> {
  return chrome.runtime.sendMessage(msg) as Promise<KibaResponse<M['kind']>>;
}
