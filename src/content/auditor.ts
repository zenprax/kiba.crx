/**
 * Content-side auditor placeholder.
 *
 * Extension auditing runs in the background service worker (see
 * src/background/auditor.ts) because chrome.management is unavailable in
 * content scripts. This thin placeholder reserves the module for any future
 * page-level shadow-IT signals (e.g. detecting injected AI widgets in the DOM).
 */

export {};
