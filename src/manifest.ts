import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

/**
 * Manifest V3 definition for kiba.crx.
 *
 * Notes vs. the spec:
 *  - Uses CRXJS `defineManifest` so .ts entry points are bundled correctly.
 *  - `clipboardRead`/`clipboardWrite` permissions are dropped: blocking a paste
 *    event with preventDefault() does not require clipboard access, so we avoid
 *    requesting unused (scary) permissions.
 *  - The declarativeNetRequest rule resource `id` is a string (as the API
 *    requires), and the ruleset path matches `rules/static_rules.json`.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'kiba.crx',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  permissions: ['declarativeNetRequest', 'storage', 'notifications', 'alarms', 'downloads'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      // CSS is injected as <style> inside the overlay's Shadow Root, so no
      // global CSS declaration here is needed (doesn't pollute host page).
      run_at: 'document_start',
      all_frames: true,
      // Inject into dynamically created about:blank / data: frames, inheriting
      // parent-frame permissions. Ensures guard works even if a malicious
      // ClickFix trap is embedded inside an about:blank iframe.
      match_about_blank: true,
    },
    {
      // Screen-sharing audit: inject into main world to hook getDisplayMedia.
      // Requires world:'MAIN' to replace navigator in the same context as the page.
      // Audit records are delegated to the isolated world (index.ts) via
      // window.postMessage.
      matches: ['<all_urls>'],
      js: ['src/content/mainWorld/getDisplayMediaPatch.ts'],
      run_at: 'document_start',
      all_frames: true,
      match_about_blank: true,
      world: 'MAIN',
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  declarative_net_request: {
    rule_resources: [
      {
        id: 'ad_rules',
        enabled: true,
        path: 'rules/static_rules.json',
      },
    ],
  },
  // Mock ZENPRAX Cloud authorization portal. Opened via window.open from popup,
  // so exposed as a static resource within the extension package to all origins.
  web_accessible_resources: [
    {
      resources: ['oauth-mock.html', 'oauth-mock.js'],
      matches: ['<all_urls>'],
    },
  ],
});
