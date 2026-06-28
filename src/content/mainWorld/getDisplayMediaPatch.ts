/**
 * Main-world hook for navigator.mediaDevices.getDisplayMedia (screen-share audit).
 *
 * This script is injected with content_scripts `world: 'MAIN'` and runs in the
 * same JS context as the page. That lets it wrap
 * `navigator.mediaDevices.getDisplayMedia` directly (the isolated world cannot
 * replace the page's navigator).
 *
 * Key constraints and approach:
 *  - The main world cannot access chrome.storage / chrome.runtime directly.
 *    Audit recording is delegated to the isolated world (screenShareHook.ts)
 *    via window.postMessage. Messages carry a marker, and the receiver
 *    validates the origin.
 *  - Auditing is best-effort. It is readable/modifiable by the page, so it is
 *    not an enforced block.
 *  - The original getDisplayMedia is **always called** (sharing itself is not
 *    blocked, preserving web compatibility).
 */

/** postMessage marker shared with the isolated world (to identify forged messages). */
export const SCREEN_SHARE_MARKER = 'kiba:screen-share-request';

function installHook(): void {
  const md = navigator.mediaDevices;
  // In some environments mediaDevices / getDisplayMedia are undefined. Do nothing.
  if (!md || typeof md.getDisplayMedia !== 'function') return;

  const original = md.getDisplayMedia.bind(md);

  // Flag to prevent double injection (if evaluated multiple times in the same frame).
  const flag = '__kibaDisplayMediaHooked';
  const w = window as unknown as Record<string, unknown>;
  if (w[flag]) return;
  w[flag] = true;

  md.getDisplayMedia = function patched(
    this: MediaDevices,
    ...args: [DisplayMediaStreamOptions?]
  ): Promise<MediaStream> {
    try {
      window.postMessage(
        { marker: SCREEN_SHARE_MARKER, href: window.location.href },
        window.location.origin,
      );
    } catch {
      // A postMessage failure only means a missed audit; let the feature proceed.
    }
    // Preserve the original behaviour (do not block).
    return original(...args);
  };
}

installHook();
