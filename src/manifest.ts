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
      // CSS はオーバーレイの Shadow Root 内に <style> として注入するため、
      // ここでのグローバル CSS 宣言は不要（ホストページを汚染しない）。
      run_at: 'document_start',
      all_frames: true,
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
  // 模擬 ZENPRAX Cloud 認可ポータル。popup から window.open で開くため、
  // 拡張パッケージ内の静的リソースとして全オリジンに公開する。
  web_accessible_resources: [
    {
      resources: ['oauth-mock.html', 'oauth-mock.js'],
      matches: ['<all_urls>'],
    },
  ],
});
