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
} = {
  pasteGuard: null,
  fileGater: null,
  ssoFiller: null,
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
      initSsoHandler(getCurrentSettings);
      return () => {};
    });
  } else {
    stop('ssoFiller');
  }
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

void getSettings().then((s) => {
  settings = s;
  reconcile(settings);
});

onSettingsChanged((s) => {
  settings = s;
  reconcile(settings);
});
