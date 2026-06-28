import { describe, expect, it } from 'vitest';
import { parsePolicyPayload } from './policySchema';

describe('parsePolicyPayload', () => {
  it('オブジェクトでない入力は null', () => {
    expect(parsePolicyPayload(null)).toBeNull();
    expect(parsePolicyPayload('x')).toBeNull();
    expect(parsePolicyPayload(42)).toBeNull();
    expect(parsePolicyPayload([])).toBeNull();
  });

  it('有効な真偽値・モード・テナントを抽出する', () => {
    const patch = parsePolicyPayload({
      antiClickFixEnabled: false,
      maskEnabled: true,
      ssoEnabled: true,
      auditExtensionsEnabled: false,
      mode: 'DRY_RUN',
      tenantWhitelist: [{ provider: 'slack', tenantId: 'T1', label: 'L1' }],
    });
    expect(patch).toEqual({
      antiClickFixEnabled: false,
      maskEnabled: true,
      ssoEnabled: true,
      auditExtensionsEnabled: false,
      mode: 'DRY_RUN',
      tenantWhitelist: [{ provider: 'slack', tenantId: 'T1', label: 'L1' }],
    });
  });

  it('不正な型のフィールドは無視する', () => {
    const patch = parsePolicyPayload({
      antiClickFixEnabled: 'yes',
      mode: 'INVALID',
      maskEnabled: true,
    });
    expect(patch).toEqual({ maskEnabled: true });
  });

  it('ssoCredentials と auditLog はマージ対象から除外する', () => {
    const patch = parsePolicyPayload({
      maskEnabled: true,
      ssoCredentials: [{ urlMatch: 'x', username: 'u', password: 'p', autoSubmit: false }],
      auditLog: [{ ts: 1, type: 'paste-block', detail: 'd', domain: 'x' }],
    });
    expect(patch).toEqual({ maskEnabled: true });
    expect(patch).not.toHaveProperty('ssoCredentials');
    expect(patch).not.toHaveProperty('auditLog');
  });

  it('テナント配列に不正要素が混じると配列ごと破棄する', () => {
    const patch = parsePolicyPayload({
      tenantWhitelist: [
        { provider: 'slack', tenantId: 'T1', label: 'L1' },
        { provider: 'invalid', tenantId: 'T2', label: 'L2' },
      ],
    });
    expect(patch).toEqual({});
  });

  it('auth は来たサブフィールドのみ部分パッチで返す', () => {
    expect(parsePolicyPayload({ auth: { offlineStrategy: 'LOCKDOWN' } })).toEqual({
      auth: { offlineStrategy: 'LOCKDOWN' },
    });
    expect(parsePolicyPayload({ auth: { ssoTtlExpiresAt: 123 } })).toEqual({
      auth: { ssoTtlExpiresAt: 123 },
    });
    expect(parsePolicyPayload({ auth: { ssoTtlExpiresAt: null } })).toEqual({
      auth: { ssoTtlExpiresAt: null },
    });
  });

  it('auth に有効なサブフィールドが無ければ auth を含めない', () => {
    expect(parsePolicyPayload({ auth: { offlineStrategy: 'BOGUS' } })).toEqual({});
  });

  it('featureModes は未知の機能キーを strip して既知キーのみ採用する', () => {
    const patch = parsePolicyPayload({
      featureModes: { paste: 'DRY_RUN', file: 'ENFORCE', bogus: 'DRY_RUN' },
    });
    expect(patch).toEqual({ featureModes: { paste: 'DRY_RUN', file: 'ENFORCE' } });
  });

  it('featureModes の既知キーに不正なモード値があるとフィールドごと破棄する', () => {
    // An invalid enum value for tenant -> object parse fails -> the whole featureModes is dropped.
    expect(parsePolicyPayload({ featureModes: { paste: 'DRY_RUN', tenant: 'NOPE' } })).toEqual({});
  });

  it('customPatterns は長さ上限・件数上限を超えるソースを弾く', () => {
    const ok = parsePolicyPayload({
      customPatterns: { danger: ['rm -rf'], secrets: [{ label: 'Token', pattern: 'tok_\\w+' }] },
    });
    expect(ok).toEqual({
      customPatterns: { danger: ['rm -rf'], secrets: [{ label: 'Token', pattern: 'tok_\\w+' }] },
    });

    // A RegExp source longer than 512 chars makes the whole array be dropped (per-field safeParse).
    const tooLong = 'a'.repeat(600);
    expect(parsePolicyPayload({ customPatterns: { danger: [tooLong] } })).toEqual({});
  });

  it('tenantRules は構造が合致したルールのみ採用する', () => {
    const patch = parsePolicyPayload({
      tenantRules: [
        {
          provider: 'notion',
          hostMatch: '*.notion.so',
          extract: { source: 'pathname', regex: '/([a-z0-9-]+)', group: 1 },
        },
      ],
    });
    expect(patch).toEqual({
      tenantRules: [
        {
          provider: 'notion',
          hostMatch: '*.notion.so',
          extract: { source: 'pathname', regex: '/([a-z0-9-]+)', group: 1 },
        },
      ],
    });

    // If source is invalid, the whole array is dropped.
    expect(
      parsePolicyPayload({
        tenantRules: [
          { provider: 'x', hostMatch: 'h', extract: { source: 'query', regex: 'r', group: 0 } },
        ],
      }),
    ).toEqual({});
  });

  it('Download Gater / 画面共有監査の真偽値・配列を採用する', () => {
    const patch = parsePolicyPayload({
      downloadGaterEnabled: true,
      downloadAllowlist: ['files.example.com'],
      screenShareAuditEnabled: true,
    });
    expect(patch).toEqual({
      downloadGaterEnabled: true,
      downloadAllowlist: ['files.example.com'],
      screenShareAuditEnabled: true,
    });
  });
});
