import React from 'react';
import ReactDOM from 'react-dom/client';
import { cssVariables, scrollbarCss, getTheme } from '@zenprax/design-tokens';
import { getSettings, onSettingsChanged } from '../lib/storage';
import { Popup } from './Popup';
import './index.css';

const themeStyleEl = document.createElement('style');
document.head.appendChild(themeStyleEl);

function applyTheme(mode: 'dark' | 'light') {
  const { color } = getTheme(mode);
  // extra vars not emitted by cssVariables()
  const extra = [
    `  --zp-toggle-off: ${color.toggle.off};`,
    `  --zp-toggle-knob: ${color.toggle.knob};`,
    `  --zp-input-border: ${color.input.border};`,
    `  --zp-btn-danger-bg: ${color.btn['danger-bg']};`,
  ].join('\n');

  themeStyleEl.textContent =
    cssVariables(mode, ':root') +
    `\n:root {\n${extra}\n}\n` +
    scrollbarCss(mode);

  document.documentElement.setAttribute('data-theme', mode);
}

applyTheme('dark');
void getSettings().then((s) => applyTheme(s.theme ?? 'dark'));
onSettingsChanged((s) => applyTheme(s.theme ?? 'dark'));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
