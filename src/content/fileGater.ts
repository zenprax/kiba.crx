/**
 * Feature: File-upload interceptor + One-Time Bypass simulation.
 *
 * On restricted (foreign-tenant) contexts, file uploads via <input type=file>
 * change events and drag-and-drop are gated behind a simulated single-use
 * "One-Time Bypass" token. In DRY_RUN mode no preventDefault is applied; only
 * `[DRY_RUN]`-tagged audit entries are emitted.
 */

import { isDryRunFor, tagDetail } from '../lib/dryRun';
import { consumeBypass, isBypassValid } from '../lib/bypass';
import { addAuditLog, getSettings as readSettings, setSettings } from '../lib/storage';
import type { KibaSettings } from '../types';
import { isRestrictedContext } from './tenant';
import { notify, showRequestBypassModal } from './overlay';

const HOSTNAME = window.location.hostname;

/**
 * Grant ids already consumed in *this* tab/frame. Updated synchronously the
 * moment a grant is honored so a second change/drop event in the same tab is
 * blocked immediately, before the async setSettings write + storage.onChanged
 * round-trip refreshes the cached settings (closes the TOCTOU window).
 */
const consumedGrantIds = new Set<string>();

/**
 * Registers the capture-phase change/drop handlers. `getSettings` is a
 * synchronous getter returning the cached settings (or null before load) used
 * to read the enforcement mode. Returns a teardown function.
 */
export function initFileGater(getSettings: () => KibaSettings | null): () => void {
  const onChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.type !== 'file' || !target.files || target.files.length === 0) {
      return;
    }

    const settings = getSettings();
    const dryRun = isDryRunFor(settings, 'file');
    if (dryRun) {
      // Simulated gate: log only, let the upload proceed.
      if (isRestrictedContext(settings)) {
        void addAuditLog(
          'file-block',
          tagDetail(`Blocked file upload on ${HOSTNAME}`, true),
          HOSTNAME,
        );
      }
      return;
    }

    // Unrestricted (trusted-tenant/whitelisted) context: nothing to gate.
    if (!isRestrictedContext(settings)) return;

    // Synchronous bypass decision against the cached settings. A valid One-Time
    // grant lets the original change event flow straight through to the host so
    // the upload succeeds on the *first* selection — no preventDefault, no
    // "re-select your file" round trip.
    const grant = settings?.oneTimeBypass ?? null;
    if (grant && isBypassValid(grant, HOSTNAME) && !consumedGrantIds.has(grant.id)) {
      // Mark consumed synchronously so a second change event in this tab is
      // blocked immediately, before the async write below lands. Then let the
      // original event proceed untouched and persist the consumed grant for
      // cross-tab consistency.
      consumedGrantIds.add(grant.id);
      void setSettings({ oneTimeBypass: consumeBypass(grant) });
      notify('kiba.crx', 'One-Time Upload allowed and consumed.');
      return;
    }

    // No valid bypass (or settings not yet loaded): block, reset, and prompt.
    event.preventDefault();
    event.stopPropagation();
    target.value = '';
    void addAuditLog(
      'file-block',
      tagDetail(`Blocked file upload on ${HOSTNAME}`, false),
      HOSTNAME,
    );
    showRequestBypassModal(HOSTNAME);
  };

  const onDrop = (event: DragEvent): void => {
    const hasFiles = (event.dataTransfer?.files?.length ?? 0) > 0;
    if (!hasFiles) return;
    const settings = getSettings();
    if (!isRestrictedContext(settings)) return;

    const dryRun = isDryRunFor(settings, 'file');
    if (dryRun) {
      // Simulated gate: log only, let the drop proceed.
      void addAuditLog(
        'file-block',
        tagDetail(`Blocked file drop on ${HOSTNAME}`, true),
        HOSTNAME,
      );
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    void readSettings().then(async (current) => {
      const grant = current.oneTimeBypass;
      if (grant && isBypassValid(grant, HOSTNAME) && !consumedGrantIds.has(grant.id)) {
        consumedGrantIds.add(grant.id);
        await setSettings({ oneTimeBypass: consumeBypass(grant) });
        notify('kiba.crx', 'One-Time drop allowed and consumed. Please drop the file again.');
        return;
      }
      await addAuditLog(
        'file-block',
        tagDetail(`Blocked file drop on ${HOSTNAME}`, false),
        HOSTNAME,
      );
      showRequestBypassModal(HOSTNAME);
    });
  };

  document.addEventListener('change', onChange, true);
  document.addEventListener('drop', onDrop, true);
  return () => {
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('drop', onDrop, true);
  };
}
