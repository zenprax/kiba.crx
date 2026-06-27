/**
 * Regression tests for the file-upload gate's single-use bypass consumption.
 *
 * Focus: a valid One-Time grant must let exactly ONE change event through. A
 * second change event fired before the async setSettings write lands (the
 * TOCTOU window) must be blocked, even though the cached settings still hold
 * the same valid grant. Runs in a lightweight fake DOM so no jsdom dependency
 * is required.
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BypassGrant, KibaSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const HOSTNAME = 'app.example.com';

// --- Module mocks: keep the gate's collaborators inert/observable. ---
const setSettings = vi.fn<(patch: Partial<KibaSettings>) => Promise<KibaSettings>>(
  () => new Promise(() => {}), // never resolves: simulates an in-flight storage write
);
const addAuditLog = vi.fn((..._args: unknown[]) => Promise.resolve());
const readSettings = vi.fn(() => Promise.resolve(DEFAULT_SETTINGS));
const isRestrictedContext = vi.fn(() => true);
const notify = vi.fn((..._args: unknown[]) => {});
const showRequestBypassModal = vi.fn((..._args: unknown[]) => {});

vi.mock('../lib/storage', () => ({
  setSettings: (patch: Partial<KibaSettings>) => setSettings(patch),
  getSettings: () => readSettings(),
  addAuditLog: (...args: unknown[]) => addAuditLog(...args),
}));
vi.mock('./tenant', () => ({
  isRestrictedContext: () => isRestrictedContext(),
}));
vi.mock('./overlay', () => ({
  notify: (...args: unknown[]) => notify(...args),
  showRequestBypassModal: (...args: unknown[]) => showRequestBypassModal(...args),
}));
// dryRun: never simulated, so the real enforcement path runs.
vi.mock('../lib/dryRun', () => ({
  isDryRun: () => false,
  tagDetail: (detail: string) => detail,
}));

/** A capture-phase change-event registry mimicking document.addEventListener. */
const changeHandlers: Array<(e: Event) => void> = [];

/** Builds a valid single-use grant for HOSTNAME. */
function makeValidGrant(): BypassGrant {
  return {
    id: 'grant-1',
    domain: HOSTNAME,
    grantedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    remainingUses: 1,
  };
}

/** Minimal fake file <input> + change Event sharing a target. */
function dispatchChange(): { defaultPrevented: boolean; value: string } {
  const target = {
    type: 'file',
    files: [{ name: 'a.txt' }],
    value: 'a.txt',
  };
  let defaultPrevented = false;
  const event = {
    target,
    preventDefault: () => {
      defaultPrevented = true;
    },
    stopPropagation: () => {},
  } as unknown as Event;
  for (const h of changeHandlers) h(event);
  return {
    get defaultPrevented() {
      return defaultPrevented;
    },
    get value() {
      return target.value;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  changeHandlers.length = 0;
  setSettings.mockClear();
  notify.mockClear();
  showRequestBypassModal.mockClear();
  isRestrictedContext.mockReturnValue(true);

  // Fake the globals the module touches at import time.
  vi.stubGlobal('window', { location: { hostname: HOSTNAME } });
  vi.stubGlobal('document', {
    addEventListener: (type: string, handler: (e: Event) => void) => {
      if (type === 'change') changeHandlers.push(handler);
    },
    removeEventListener: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fileGater one-time bypass consumption', () => {
  it('lets the first change through and consumes the grant once', async () => {
    const grant = makeValidGrant();
    const { initFileGater } = await import('./fileGater');
    initFileGater(() => ({ ...DEFAULT_SETTINGS, oneTimeBypass: grant }));

    const first = dispatchChange();

    expect(first.defaultPrevented).toBe(false);
    expect(first.value).toBe('a.txt'); // upload proceeds untouched
    expect(setSettings).toHaveBeenCalledTimes(1);
    expect(showRequestBypassModal).not.toHaveBeenCalled();
  });

  it('blocks a second change fired before the async write lands (TOCTOU)', async () => {
    const grant = makeValidGrant();
    const { initFileGater } = await import('./fileGater');
    // Getter keeps returning the SAME valid grant — the cached settings have
    // not been refreshed yet because setSettings never resolves.
    initFileGater(() => ({ ...DEFAULT_SETTINGS, oneTimeBypass: grant }));

    const first = dispatchChange();
    const second = dispatchChange();

    expect(first.defaultPrevented).toBe(false);
    expect(second.defaultPrevented).toBe(true); // blocked
    expect(second.value).toBe(''); // input reset
    expect(setSettings).toHaveBeenCalledTimes(1); // consumed only once
    expect(showRequestBypassModal).toHaveBeenCalledTimes(1);
  });

  it('blocks when there is no valid grant', async () => {
    const { initFileGater } = await import('./fileGater');
    initFileGater(() => ({ ...DEFAULT_SETTINGS, oneTimeBypass: null }));

    const result = dispatchChange();

    expect(result.defaultPrevented).toBe(true);
    expect(result.value).toBe('');
    expect(setSettings).not.toHaveBeenCalled();
    expect(showRequestBypassModal).toHaveBeenCalledTimes(1);
  });
});
