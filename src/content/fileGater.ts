/**
 * Feature: File-upload interceptor + One-Time Bypass simulation.
 *
 * On restricted (foreign-tenant) contexts, file uploads via <input type=file>
 * change events and drag-and-drop are gated behind a simulated single-use
 * "One-Time Bypass" token. In DRY_RUN mode no preventDefault is applied; only
 * `[DRY_RUN]`-tagged audit entries are emitted.
 */

import { isDryRun, tagDetail } from '../lib/dryRun';
import { consumeBypass, isBypassValid } from '../lib/bypass';
import { addAuditLog, getSettings as readSettings, setSettings } from '../lib/storage';
import type { KibaSettings } from '../types';
import { isRestrictedContext } from './tenant';
import { notify, showRequestBypassModal } from './overlay';

const HOSTNAME = window.location.hostname;

/**
 * Decides whether an upload on the current domain should be gated and, if so,
 * handles the block/bypass workflow. Returns true if the upload was blocked.
 * `dryRun` only affects logging here; the caller handles preventDefault.
 */
async function handleUploadAttempt(
  reset: () => void,
  dryRun: boolean,
  settings: KibaSettings | null,
): Promise<boolean> {
  if (!isRestrictedContext(settings)) return false;

  const current = await readSettings();
  const grant = current.oneTimeBypass;
  if (grant && isBypassValid(grant, HOSTNAME)) {
    // 有効な単回付与を 1 回消費し、このアップロードを通す。
    await setSettings({ oneTimeBypass: consumeBypass(grant) });
    notify('kiba.crx', 'One-Time Upload allowed and consumed.');
    return false;
  }

  reset();
  await addAuditLog(
    'file-block',
    tagDetail(`Blocked file upload on ${HOSTNAME}`, dryRun),
    HOSTNAME,
  );
  showRequestBypassModal(HOSTNAME);
  return true;
}

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
    const dryRun = isDryRun(settings);
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

    // Block synchronously; resolve the async policy decision immediately after.
    // We optimistically prevent default and only re-allow on bypass.
    event.preventDefault();
    event.stopPropagation();

    void handleUploadAttempt(() => {
      target.value = '';
    }, false, settings).then((blocked) => {
      if (!blocked) {
        // Token consumed: notify the user to retrigger; we cannot replay the
        // original file selection programmatically from the isolated world.
        notify('kiba.crx', 'Upload permitted. Please re-select your file to proceed.');
      }
    });
  };

  const onDrop = (event: DragEvent): void => {
    const hasFiles = (event.dataTransfer?.files?.length ?? 0) > 0;
    if (!hasFiles) return;
    const settings = getSettings();
    if (!isRestrictedContext(settings)) return;

    const dryRun = isDryRun(settings);
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
      if (grant && isBypassValid(grant, HOSTNAME)) {
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
