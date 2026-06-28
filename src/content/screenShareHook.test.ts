/**
 * Tests for the isolated-world listener of screen-share auditing.
 *
 * Verifies that forged postMessages from the page are rejected and that
 * addAuditLog is called only for legitimate marker-bearing messages. Runs on a
 * lightweight fake DOM (node environment).
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOSTNAME = 'app.example.com';
const ORIGIN = `https://${HOSTNAME}`;

const addAuditLog = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('../lib/storage', () => ({
  addAuditLog: (...args: unknown[]) => addAuditLog(...args),
}));

/** Registry of message listeners (mimics window.addEventListener). */
const messageHandlers: Array<(e: MessageEvent<unknown>) => void> = [];

/** Builds a MessageEvent-like object and dispatches it to all listeners. */
function dispatchMessage(partial: { data: unknown; source?: unknown; origin?: string }): void {
  const event = {
    data: partial.data,
    source: 'source' in partial ? partial.source : globalThis.window,
    origin: partial.origin ?? ORIGIN,
  } as unknown as MessageEvent<unknown>;
  for (const h of messageHandlers) h(event);
}

beforeEach(() => {
  vi.resetModules();
  messageHandlers.length = 0;
  addAuditLog.mockClear();

  vi.stubGlobal('window', {
    location: { hostname: HOSTNAME, origin: ORIGIN, href: `${ORIGIN}/page` },
    addEventListener: (type: string, handler: (e: MessageEvent<unknown>) => void) => {
      if (type === 'message') messageHandlers.push(handler);
    },
    removeEventListener: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initScreenShareHook', () => {
  const MARKER = 'kiba:screen-share-request';

  it('正規のマーカー付きメッセージで監査ログを記録する', async () => {
    const { initScreenShareHook } = await import('./screenShareHook');
    initScreenShareHook();

    dispatchMessage({ data: { marker: MARKER, href: `${ORIGIN}/p` } });

    expect(addAuditLog).toHaveBeenCalledTimes(1);
    expect(addAuditLog).toHaveBeenCalledWith(
      'screen-share',
      expect.stringContaining(HOSTNAME),
      HOSTNAME,
    );
  });

  it('別ソース（event.source !== window）のメッセージは無視する', async () => {
    const { initScreenShareHook } = await import('./screenShareHook');
    initScreenShareHook();

    dispatchMessage({ data: { marker: MARKER }, source: { fake: true } });
    expect(addAuditLog).not.toHaveBeenCalled();
  });

  it('別オリジンのメッセージは無視する', async () => {
    const { initScreenShareHook } = await import('./screenShareHook');
    initScreenShareHook();

    dispatchMessage({ data: { marker: MARKER }, origin: 'https://evil.com' });
    expect(addAuditLog).not.toHaveBeenCalled();
  });

  it('マーカー不一致の偽メッセージは無視する', async () => {
    const { initScreenShareHook } = await import('./screenShareHook');
    initScreenShareHook();

    dispatchMessage({ data: { marker: 'not-kiba' } });
    dispatchMessage({ data: 'random string' });
    dispatchMessage({ data: null });
    expect(addAuditLog).not.toHaveBeenCalled();
  });

  it('teardown でリスナを解除する', async () => {
    const removed: string[] = [];
    (
      globalThis.window as unknown as { removeEventListener: (t: string) => void }
    ).removeEventListener = (t: string) => removed.push(t);

    const { initScreenShareHook } = await import('./screenShareHook');
    const teardown = initScreenShareHook();
    teardown();
    expect(removed).toContain('message');
  });
});
