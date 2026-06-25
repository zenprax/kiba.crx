/**
 * Feature: Anti-ClickFix copy guard (capture-phase copy handler).
 *
 * ClickFix attacks trick users into copying an OS command from a malicious page
 * and pasting it into a terminal. We intercept the copy event at its source so
 * dangerous payloads never reach the clipboard in the first place.
 *
 * Two stages, evaluated in order:
 *  1. Dangerous OS-command copies are blocked outright.
 *  2. In a restricted (foreign-tenant) context, confidential data is masked and
 *     the cleansed text is written to the clipboard instead.
 *
 * In DRY_RUN mode no preventDefault is applied; only `[DRY_RUN]`-tagged audit
 * entries are emitted so IT can pilot the policy without disrupting users.
 */

import { isDryRun, tagDetail } from '../lib/dryRun';
import {
  describeMask,
  describePasteThreat,
  isDangerousPaste,
  sanitizePaste,
} from '../lib/patterns';
import { addAuditLog } from '../lib/storage';
import type { KibaSettings } from '../types';
import { isRestrictedContext } from './tenant';
import { showDangerOverlay } from './overlay';

const HOSTNAME = window.location.hostname;

/**
 * Registers the capture-phase copy handler. `getSettings` is a synchronous
 * getter (copy events can't await) returning the cached settings or null
 * before they have loaded. Returns a teardown function that unregisters the
 * listener.
 */
export function initPasteGuard(getSettings: () => KibaSettings | null): () => void {
  const handler = (event: ClipboardEvent): void => {
    const settings = getSettings();

    // Respect the admin toggle; default to enabled until settings load.
    if (settings && !settings.antiClickFixEnabled) return;

    const dryRun = isDryRun(settings);
    const selectedText = window.getSelection()?.toString() ?? '';

    // Stage 1: dangerous OS commands are always fully blocked.
    if (isDangerousPaste(selectedText)) {
      const detail = tagDetail(describePasteThreat(selectedText), dryRun);
      if (dryRun) {
        void addAuditLog('paste-block', detail, HOSTNAME);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showDangerOverlay(
        'Blocked Dangerous Copy',
        'The text you tried to copy contains administrative OS commands. The copy operation was cancelled.',
      );
      void addAuditLog('paste-block', detail, HOSTNAME);
      return;
    }

    // Stage 2: in a restricted (foreign-tenant) context, mask confidential data
    // before it reaches the clipboard.
    const maskEnabled = settings?.maskEnabled ?? true;
    if (!maskEnabled || !isRestrictedContext(settings)) return;

    const result = sanitizePaste(selectedText);
    if (!result.masked) return;

    const detail = tagDetail(describeMask(result), dryRun);
    if (dryRun) {
      void addAuditLog('paste-mask', detail, HOSTNAME);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.clipboardData?.setData('text/plain', result.sanitized);
    void addAuditLog('paste-mask', detail, HOSTNAME);
  };

  // capture phase: intercept before the page sees it.
  document.addEventListener('copy', handler, true);
  return () => document.removeEventListener('copy', handler, true);
}
