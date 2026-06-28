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

import { isDryRunFor, tagDetail } from '../lib/dryRun';
import {
  describeMask,
  describePasteThreat,
  getActiveDangerPatterns,
  getActiveSecretPatterns,
  isDangerousPaste,
  sanitizePaste,
  type SanitizeResult,
} from '../lib/patterns';
import { addAuditLog } from '../lib/storage';
import type { KibaSettings } from '../types';
import { isRestrictedContext } from './tenant';
import { showDangerOverlay } from './overlay';

const HOSTNAME = window.location.hostname;

/**
 * Masks the text nodes within the clipboard's text/html and returns an HTML
 * string with formatting preserved. Returns null when text/html is empty or
 * DOMParser fails to parse it.
 */
function sanitizeHtmlClipboard(
  html: string,
  patterns: { label: string; pattern: RegExp }[],
): { html: string; result: SanitizeResult } | null {
  if (!html) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }

  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let anyMasked = false;
  const allLabels: string[] = [];

  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const text = node.nodeValue ?? '';
    if (!text) continue;
    const r = sanitizePaste(text, patterns);
    if (r.masked) {
      node.nodeValue = r.sanitized;
      anyMasked = true;
      for (const l of r.matchedLabels) {
        if (!allLabels.includes(l)) allLabels.push(l);
      }
    }
  }

  if (!anyMasked) return null;
  return {
    html: new XMLSerializer().serializeToString(doc),
    result: { sanitized: doc.body.textContent ?? '', masked: true, matchedLabels: allLabels },
  };
}

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

    const selectedText = window.getSelection()?.toString() ?? '';

    // Stage 1: dangerous OS commands are always fully blocked. Matched against
    // built-in + OTA custom danger patterns, following the 'paste' feature mode
    // (falls back to the global mode when unset).
    if (isDangerousPaste(selectedText, getActiveDangerPatterns(settings))) {
      const dryRun = isDryRunFor(settings, 'paste');
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
    // before it reaches the clipboard. This is a tenant-restriction action, so
    // it follows the 'tenant' feature mode (falls back to the global mode).
    const maskEnabled = settings?.maskEnabled ?? true;
    if (!maskEnabled || !isRestrictedContext(settings)) return;

    const activePatterns = getActiveSecretPatterns(settings);
    const result = sanitizePaste(selectedText, activePatterns);
    if (!result.masked) return;

    const dryRun = isDryRunFor(settings, 'tenant');
    const detail = tagDetail(describeMask(result), dryRun);
    if (dryRun) {
      void addAuditLog('paste-mask', detail, HOSTNAME);
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    // When text/html is present, mask only the text nodes to preserve formatting.
    const rawHtml = event.clipboardData?.getData('text/html') ?? '';
    const htmlMasked = rawHtml ? sanitizeHtmlClipboard(rawHtml, activePatterns) : null;
    if (htmlMasked) {
      event.clipboardData?.setData('text/html', htmlMasked.html);
    }
    event.clipboardData?.setData('text/plain', result.sanitized);
    void addAuditLog('paste-mask', detail, HOSTNAME);
  };

  // capture phase: intercept before the page sees it.
  document.addEventListener('copy', handler, true);
  return () => document.removeEventListener('copy', handler, true);
}
