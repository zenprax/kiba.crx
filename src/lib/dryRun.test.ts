import { describe, expect, it } from 'vitest';
import { DRY_RUN_PREFIX, isDryRun, isDryRunFor, tagDetail } from './dryRun';

describe('isDryRun', () => {
  it('returns true when mode is DRY_RUN', () => {
    expect(isDryRun({ mode: 'DRY_RUN' })).toBe(true);
  });

  it('returns false when mode is ENFORCE', () => {
    expect(isDryRun({ mode: 'ENFORCE' })).toBe(false);
  });

  it('returns false for null/undefined settings', () => {
    expect(isDryRun(null)).toBe(false);
    expect(isDryRun(undefined)).toBe(false);
  });
});

describe('isDryRunFor', () => {
  it('featureModes 未設定ならグローバル mode にフォールバックする', () => {
    expect(isDryRunFor({ mode: 'DRY_RUN' }, 'paste')).toBe(true);
    expect(isDryRunFor({ mode: 'ENFORCE' }, 'paste')).toBe(false);
    expect(isDryRunFor({ mode: 'DRY_RUN', featureModes: {} }, 'file')).toBe(true);
  });

  it('該当機能の上書きがあればそれを優先する', () => {
    // 全体は ENFORCE だがペーストだけ DRY_RUN。
    const s = { mode: 'ENFORCE', featureModes: { paste: 'DRY_RUN' } } as const;
    expect(isDryRunFor(s, 'paste')).toBe(true);
    expect(isDryRunFor(s, 'file')).toBe(false); // 上書きなし → ENFORCE
  });

  it('全体 DRY_RUN でも機能だけ ENFORCE に上書きできる', () => {
    const s = { mode: 'DRY_RUN', featureModes: { file: 'ENFORCE' } } as const;
    expect(isDryRunFor(s, 'file')).toBe(false);
    expect(isDryRunFor(s, 'paste')).toBe(true); // 上書きなし → DRY_RUN
  });

  it('null/undefined は false', () => {
    expect(isDryRunFor(null, 'paste')).toBe(false);
    expect(isDryRunFor(undefined, 'download')).toBe(false);
  });
});

describe('tagDetail', () => {
  it('prepends the prefix when in dry run', () => {
    expect(tagDetail('Blocked PowerShell paste', true)).toBe(
      `${DRY_RUN_PREFIX} Blocked PowerShell paste`,
    );
  });

  it('returns the detail unchanged when not in dry run', () => {
    expect(tagDetail('Blocked PowerShell paste', false)).toBe('Blocked PowerShell paste');
  });

  it('does not double-prefix', () => {
    const once = tagDetail('blocked', true);
    expect(tagDetail(once, true)).toBe(once);
  });
});
