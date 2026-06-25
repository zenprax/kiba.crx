import { describe, expect, it } from 'vitest';
import { DRY_RUN_PREFIX, isDryRun, tagDetail } from './dryRun';

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
