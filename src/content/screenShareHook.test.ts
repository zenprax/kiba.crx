/**
 * 画面共有監査の isolated-world リスナのテスト。
 *
 * ページからの偽 postMessage を拒否し、正規のマーカー付きメッセージのみで
 * addAuditLog を呼ぶことを検証する。軽量 fake DOM（node 環境）で動かす。
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOSTNAME = 'app.example.com';
const ORIGIN = `https://${HOSTNAME}`;

const addAuditLog = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('../lib/storage', () => ({
  addAuditLog: (...args: unknown[]) => addAuditLog(...args),
}));

/** message リスナのレジストリ（window.addEventListener を模倣）。 */
const messageHandlers: Array<(e: MessageEvent<unknown>) => void> = [];

/** MessageEvent ライクなオブジェクトを組み立てて全リスナへ流す。 */
function dispatchMessage(partial: {
  data: unknown;
  source?: unknown;
  origin?: string;
}): void {
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
    (globalThis.window as unknown as { removeEventListener: (t: string) => void }).removeEventListener =
      (t: string) => removed.push(t);

    const { initScreenShareHook } = await import('./screenShareHook');
    const teardown = initScreenShareHook();
    teardown();
    expect(removed).toContain('message');
  });
});
