import { tailwindTheme, getTheme } from '@zenprax/design-tokens';

/**
 * Popup UI 用 Tailwind 設定。
 *
 * 色・影・余白・フォントサイズはすべて @zenprax/design-tokens が単一ソース。
 * 生の色コード／生の色名／生の数値をこの設定に直書きすることは禁止しており、
 * 値はすべてパッケージの `tailwindTheme` / `getTheme` から取得する。
 *
 * Popup は常時ダークのため `'dark'` テーマを固定で展開する。
 * Content-script の overlay は Shadow DOM 内の生 CSS（overlayStyles.ts）で
 * 別管理しており、ここ（Tailwind 生成）には意図的に参加しない。
 */
const tw = tailwindTheme('dark');
const theme = getTheme('dark');

// Tailwind の flat colors マップに展開されないセマンティック色のうち、
// 既存トークンで等価代替できないものだけを補完する（値は getTheme 由来＝生 HEX 直書きしない）。
const extraColors = {
  'toggle-off': theme.color.toggle.off,
  'toggle-knob': theme.color.toggle.knob,
  'input-border': theme.color.input.border,
  'btn-danger-bg': theme.color.btn['danger-bg'],
};

// Primitive spacing / radius を `zp-*` キーで提供し、内部余白・角丸を
// トークン経由でのみ指定できるようにする（開発者による任意数値を排除）。
const zpSpacing = Object.fromEntries(
  Object.entries(theme.spacing).map(([k, v]) => [`zp-${k}`, v]),
);
const zpRadius = Object.fromEntries(
  Object.entries(theme.radius).map(([k, v]) => [`zp-${k}`, v]),
);

/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind is only used by the popup UI. The content-script overlay is styled
  // with self-contained plain CSS injected into a Shadow Root (overlayStyles.ts),
  // so it intentionally does not participate in Tailwind generation.
  content: ['./src/popup/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      ...tw,
      colors: {
        ...tw.colors,
        ...extraColors,
      },
      spacing: {
        ...tw.spacing,
        ...zpSpacing,
      },
      borderRadius: zpRadius,
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
