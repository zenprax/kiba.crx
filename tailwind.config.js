import { getTheme } from '@zenprax/design-tokens';

/**
 * Popup UI 用 Tailwind 設定。
 *
 * 色はすべて CSS 変数（--zp-*）参照にすることでランタイムテーマ切替に対応する。
 * 変数の実値は main.tsx で cssVariables() を注入することで設定される。
 * spacing・radius・fontFamily はビルド時固定で問題ないためトークン直値を使う。
 */
const theme = getTheme('dark');

// spacing・radius はテーマ非依存のプリミティブ値（dark/light で同一）
const zpSpacing = Object.fromEntries(
  Object.entries(theme.spacing).map(([k, v]) => [`zp-${k}`, v]),
);
const zpRadius = Object.fromEntries(
  Object.entries(theme.radius).map(([k, v]) => [`zp-${k}`, v]),
);
const zpFontSize = Object.fromEntries(
  Object.entries(theme.font.size).map(([k, v]) => [`zp-${k}`, v]),
);

// 全セマンティックカラーを --zp-* 変数参照にマップする
const zpColors = {
  'bg-base':    'var(--zp-bg-base)',
  'bg-subtle':  'var(--zp-bg-subtle)',
  'bg-surface': 'var(--zp-bg-surface)',
  'bg-overlay': 'var(--zp-bg-overlay)',

  'surface-chrome-bg':    'var(--zp-surface-chrome-bg)',
  'surface-chrome-text':  'var(--zp-surface-chrome-text)',
  'surface-chrome-muted': 'var(--zp-surface-chrome-muted)',

  'brand-primary': 'var(--zp-brand-primary)',
  'brand-hover':   'var(--zp-brand-hover)',
  'brand-muted':   'var(--zp-brand-muted)',

  'text-primary':   'var(--zp-text-primary)',
  'text-secondary': 'var(--zp-text-secondary)',
  'text-muted':     'var(--zp-text-muted)',
  'text-on-brand':  'var(--zp-text-on-brand)',

  'border-default': 'var(--zp-border-default)',
  'border-strong':  'var(--zp-border-strong)',

  'status-safe-bg':     'var(--zp-status-safe-bg)',
  'status-safe-text':   'var(--zp-status-safe-text)',
  'status-safe-border': 'var(--zp-status-safe-border)',
  'status-block-bg':     'var(--zp-status-block-bg)',
  'status-block-text':   'var(--zp-status-block-text)',
  'status-block-border': 'var(--zp-status-block-border)',
  'status-warn-bg':     'var(--zp-status-warn-bg)',
  'status-warn-text':   'var(--zp-status-warn-text)',
  'status-warn-border': 'var(--zp-status-warn-border)',
  'status-info-bg':     'var(--zp-status-info-bg)',
  'status-info-text':   'var(--zp-status-info-text)',
  'status-info-border': 'var(--zp-status-info-border)',

  'status-pulse-safe': 'var(--zp-status-pulse-safe)',
  'status-pulse-warn': 'var(--zp-status-pulse-warn)',
  'status-pulse-crit': 'var(--zp-status-pulse-crit)',
  'status-ring-safe':   'var(--zp-status-ring-safe)',
  'status-ring-safe-2': 'var(--zp-status-ring-safe-2)',
  'status-ring-warn':   'var(--zp-status-ring-warn)',

  'severity-critical-bg':     'var(--zp-severity-critical-bg)',
  'severity-critical-text':   'var(--zp-severity-critical-text)',
  'severity-critical-border': 'var(--zp-severity-critical-border)',
  'severity-high-bg':     'var(--zp-severity-high-bg)',
  'severity-high-text':   'var(--zp-severity-high-text)',
  'severity-high-border': 'var(--zp-severity-high-border)',
  'severity-medium-bg':     'var(--zp-severity-medium-bg)',
  'severity-medium-text':   'var(--zp-severity-medium-text)',
  'severity-medium-border': 'var(--zp-severity-medium-border)',
  'severity-low-bg':     'var(--zp-severity-low-bg)',
  'severity-low-text':   'var(--zp-severity-low-text)',
  'severity-low-border': 'var(--zp-severity-low-border)',
  'severity-info-bg':     'var(--zp-severity-info-bg)',
  'severity-info-text':   'var(--zp-severity-info-text)',
  'severity-info-border': 'var(--zp-severity-info-border)',

  'interactive-hover':             'var(--zp-interactive-hover)',
  'interactive-active':            'var(--zp-interactive-active)',
  'interactive-selected-bg':       'var(--zp-interactive-selected-bg)',
  'interactive-selected-border':   'var(--zp-interactive-selected-border)',
  'interactive-selected-text':     'var(--zp-interactive-selected-text)',
  'interactive-disabled-bg':       'var(--zp-interactive-disabled-bg)',
  'interactive-disabled-border':   'var(--zp-interactive-disabled-border)',
  'interactive-disabled-text':     'var(--zp-interactive-disabled-text)',
  'interactive-segment-allow-bg':       'var(--zp-interactive-segment-allow-bg)',
  'interactive-segment-allow-text':     'var(--zp-interactive-segment-allow-text)',
  'interactive-segment-allow-border':   'var(--zp-interactive-segment-allow-border)',
  'interactive-segment-block-bg':       'var(--zp-interactive-segment-block-bg)',
  'interactive-segment-block-text':     'var(--zp-interactive-segment-block-text)',
  'interactive-segment-block-border':   'var(--zp-interactive-segment-block-border)',
  'interactive-segment-default-bg':     'var(--zp-interactive-segment-default-bg)',
  'interactive-segment-default-text':   'var(--zp-interactive-segment-default-text)',
  'interactive-segment-default-border': 'var(--zp-interactive-segment-default-border)',

  'stat-safe':  'var(--zp-stat-safe)',
  'stat-block': 'var(--zp-stat-block)',
  'stat-warn':  'var(--zp-stat-warn)',
  'stat-brand': 'var(--zp-stat-brand)',

  'viz-1': 'var(--zp-viz-1)', 'viz-2': 'var(--zp-viz-2)', 'viz-3': 'var(--zp-viz-3)',
  'viz-4': 'var(--zp-viz-4)', 'viz-5': 'var(--zp-viz-5)', 'viz-6': 'var(--zp-viz-6)',

  'focus-ring':             'var(--zp-focus-ring)',
  'focus-shadow':           'var(--zp-focus-shadow)',
  'focus-link-decoration':  'var(--zp-focus-link-decoration)',

  // extra: Toggle/Input/Button tokens not in tailwindTheme
  'toggle-off':    'var(--zp-toggle-off)',
  'toggle-knob':   'var(--zp-toggle-knob)',
  'input-border':  'var(--zp-input-border)',
  'btn-danger-bg': 'var(--zp-btn-danger-bg)',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/popup/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: zpColors,
      spacing: {
        ...zpSpacing,
      },
      borderRadius: zpRadius,
      fontSize: zpFontSize,
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
