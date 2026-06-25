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
});
