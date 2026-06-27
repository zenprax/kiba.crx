/**
 * Download Gater の判定ロジック（純粋関数）の単体テスト。
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { extractDownloadHost, shouldGateDownload } from './downloadGater';

describe('extractDownloadHost', () => {
  it('finalUrl を最優先で使う', () => {
    expect(
      extractDownloadHost({ finalUrl: 'https://cdn.evil.com/x.exe', url: 'https://evil.com/x' }),
    ).toBe('cdn.evil.com');
  });

  it('finalUrl 不正なら url、url 不正なら referrer にフォールバック', () => {
    expect(extractDownloadHost({ finalUrl: 'bad', url: 'https://files.example.com/a' })).toBe(
      'files.example.com',
    );
    expect(extractDownloadHost({ url: 'bad', referrer: 'https://ref.example.com/p' })).toBe(
      'ref.example.com',
    );
  });

  it('すべて解釈不能なら null', () => {
    expect(extractDownloadHost({ url: 'bad', referrer: 'also bad' })).toBeNull();
    expect(extractDownloadHost({})).toBeNull();
  });
});

describe('shouldGateDownload', () => {
  const base = { downloadGaterEnabled: true, downloadAllowlist: ['files.example.com'] };

  it('Gater 無効なら常に false', () => {
    expect(shouldGateDownload('evil.com', { ...base, downloadGaterEnabled: false })).toBe(false);
  });

  it('ホスト不明なら false（判定材料なし＝通す）', () => {
    expect(shouldGateDownload(null, base)).toBe(false);
  });

  it('allowlist 一致なら false（完全一致・サブドメイン）', () => {
    expect(shouldGateDownload('files.example.com', base)).toBe(false);
    expect(shouldGateDownload('cdn.files.example.com', base)).toBe(false);
  });

  it('未承認ホストなら true', () => {
    expect(shouldGateDownload('evil.com', base)).toBe(true);
    expect(shouldGateDownload('files.example.com.evil.com', base)).toBe(true);
  });
});
