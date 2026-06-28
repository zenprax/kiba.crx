/**
 * kiba.crx content-script orchestrator (isolated world, document_start).
 *
 * This module owns no security logic itself; instead it wires together the
 * feature plugins and starts/stops their DOM observers in response to the
 * admin feature toggles:
 *
 *  - Anti-ClickFix paste sanitizer + confidential masking  -> pasteGuard
 *  - File-upload / drag-drop interceptor + One-Time Bypass  -> fileGater
 *  - Pseudo-SSO autofill                                    -> ssoFiller
 *
 * Each plugin exposes an `init…()` that returns a teardown function. When a
 * feature is toggled OFF the orchestrator calls its teardown so the underlying
 * DOM listeners/observers stop running (spec: OFF stops the watcher).
 */

import { getSettings, onSettingsChanged } from '../lib/storage';
import type { KibaSettings } from '../types';
import { initSsoHandler } from './ssoFiller';

// Worker A owns these modules. They import `isRestrictedContext` from './tenant'
// themselves, so their init only takes the live settings getter and returns a
// teardown. NOTE(merge): these signatures were confirmed against the landed
// pasteGuard.ts / fileGater.ts; reconfirm if Worker A revises them.
import { initPasteGuard } from './pasteGuard';
import { initFileGater } from './fileGater';
import { initScreenShareHook } from './screenShareHook';

/**
 * Cached copy of settings kept in sync via chrome.storage.onChanged so the
 * (synchronous) plugin handlers can read it without awaiting.
 */
let settings: KibaSettings | null = null;

/** Live getter passed to plugins so they always see the latest settings. */
const getCurrentSettings = (): KibaSettings | null => settings;

/* ------------------------------------------------------------------ *
 * Plugin lifecycle management
 * ------------------------------------------------------------------ */

/** A teardown returned by a plugin's init, or null when the plugin is stopped. */
type Teardown = (() => void) | null;

/** Tracks the running plugins so we can stop them when a feature is disabled. */
const teardowns: {
  pasteGuard: Teardown;
  fileGater: Teardown;
  ssoFiller: Teardown;
  screenShare: Teardown;
} = {
  pasteGuard: null,
  fileGater: null,
  ssoFiller: null,
  screenShare: null,
};

/** True when either paste-related control (block or mask) is enabled. */
function pasteGuardWanted(s: KibaSettings | null): boolean {
  // Default to enabled until settings load, matching the legacy behaviour.
  if (!s) return true;
  return s.antiClickFixEnabled || s.maskEnabled;
}

/** Starts a plugin if it should run and is not already running. */
function start(key: keyof typeof teardowns, init: () => () => void): void {
  if (teardowns[key]) return;
  teardowns[key] = init();
}

/** Stops a running plugin and clears its slot. */
function stop(key: keyof typeof teardowns): void {
  teardowns[key]?.();
  teardowns[key] = null;
}

/**
 * Reconciles the running plugins against the current settings: starts the ones
 * that are enabled and stops the ones that have been turned off.
 */
function reconcile(s: KibaSettings | null): void {
  // Global kill-switch: enabled=false stops all plugins immediately.
  if (s?.enabled === false) {
    stop('pasteGuard');
    stop('fileGater');
    stop('ssoFiller');
    stop('screenShare');
    return;
  }

  // Paste guard: anti-ClickFix block and/or confidential masking.
  if (pasteGuardWanted(s)) {
    start('pasteGuard', () => initPasteGuard(getCurrentSettings));
  } else {
    stop('pasteGuard');
  }

  // File gater: legacy behaviour is always-on (no dedicated toggle), so it runs
  // for the lifetime of the content script.
  start('fileGater', () => initFileGater(getCurrentSettings));

  // Pseudo-SSO autofill.
  if (s?.ssoEnabled) {
    start('ssoFiller', () => {
      // initSsoHandler is fire-and-forget (no teardown); wrap to satisfy the
      // teardown contract. The handler self-disconnects its observer on timeout.
      void initSsoHandler(getCurrentSettings);
      return () => {};
    });
  } else {
    stop('ssoFiller');
  }

  // Screen-share audit: the main-world hook always patches getDisplayMedia, but
  // we only listen for (and record) its postMessage when auditing is enabled.
  if (s?.screenShareAuditEnabled) {
    start('screenShare', () => initScreenShareHook());
  } else {
    stop('screenShare');
  }
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

/*
 * Null-settings window: between script injection (document_start) and
 * chrome.storage.local.get resolving (~1-2 event-loop ticks), `settings`
 * is null. Safety analysis per plugin:
 *  - pasteGuard: pasteGuardWanted(null) returns true (line 61), so the
 *    guard starts immediately. Inside the handler, null settings leave
 *    antiClickFixEnabled treated as enabled — restrictive/safe direction.
 *  - fileGater: always started. With null settings, isRestrictedContext(null)
 *    returns false, so uploads are not blocked — a brief permissive window
 *    on cold start only, not on navigation. Accepted as-is.
 *  - ssoFiller / screenShare: skipped until s?.ssoEnabled /
 *    s?.screenShareAuditEnabled is truthy. No gap risk.
 *
 * An event queue was considered and rejected: the risk window is
 * sub-millisecond, plugins already fall back safely, and a queue adds
 * buffer-management complexity with no meaningful security gain.
 */
void getSettings().then((s) => {
  settings = s;
  reconcile(settings);
});

onSettingsChanged((s) => {
  settings = s;
  reconcile(settings);
});
