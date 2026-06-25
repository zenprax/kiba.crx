/**
 * Feature: Anti-ClickFix paste sanitizer (capture-phase paste handler).
 *
 * Two stages, evaluated in order:
 *  1. Dangerous OS-command pastes are blocked outright.
 *  2. In a restricted (foreign-tenant) context, confidential data is masked and
 *     the cleansed text is inserted instead of blocking.
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
 * Inserts sanitized text in place of the original paste. Uses the legacy but
 * widely-supported execCommand('insertText') which integrates with the page's
 * undo stack and respects the current selection/caret in inputs and
 * contenteditable. Falls back to direct value manipulation for inputs.
 */
function insertSanitizedText(text: string): void {
  if (document.execCommand('insertText', false, text)) return;

  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Registers the capture-phase paste handler. `getSettings` is a synchronous
 * getter (paste events can't await) returning the cached settings or null
 * before they have loaded. Returns a teardown function that unregisters the
 * listener.
 */
export function initPasteGuard(getSettings: () => KibaSettings | null): () => void {
  const handler = (event: ClipboardEvent): void => {
    const settings = getSettings();

    // Respect the admin toggle; default to enabled until settings load.
    if (settings && !settings.antiClickFixEnabled) return;

    const dryRun = isDryRun(settings);
    const pastedText = event.clipboardData?.getData('text') ?? '';

    // Stage 1: dangerous OS commands are always fully blocked. Evaluated FIRST
    // so a command can never slip through the masking path below.
    if (isDangerousPaste(pastedText)) {
      const detail = tagDetail(describePasteThreat(pastedText), dryRun);
      if (dryRun) {
        // Simulated block: log only, let the paste through.
        void addAuditLog('paste-block', detail, HOSTNAME);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showDangerOverlay(
        'Blocked Dangerous Paste',
        'The text you tried to paste contains administrative OS commands. The paste operation was cancelled.',
      );
      void addAuditLog('paste-block', detail, HOSTNAME);
      return;
    }

    // Stage 2: in a restricted (foreign-tenant) context, mask confidential data
    // and allow the cleansed text through instead of blocking the paste.
    const maskEnabled = settings?.maskEnabled ?? true;
    if (!maskEnabled || !isRestrictedContext(settings)) return;

    const result = sanitizePaste(pastedText);
    if (!result.masked) return;

    const detail = tagDetail(describeMask(result), dryRun);
    if (dryRun) {
      // Simulated mask: log only, let the original paste through.
      void addAuditLog('paste-mask', detail, HOSTNAME);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    insertSanitizedText(result.sanitized);
    void addAuditLog('paste-mask', detail, HOSTNAME);
  };

  // capture phase: intercept before the page sees it.
  document.addEventListener('paste', handler, true);
  return () => document.removeEventListener('paste', handler, true);
}
