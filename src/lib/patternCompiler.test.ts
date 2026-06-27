import { describe, expect, it } from 'vitest';
import { MAX_PATTERN_SOURCE_LEN, compileSafePattern } from './patternCompiler';

describe('compileSafePattern', () => {
  it('安全なパターンを RegExp として実体化する', () => {
    const re = compileSafePattern('tok_[a-z0-9]+', 'i');
    expect(re).toBeInstanceOf(RegExp);
    expect(re?.test('TOK_abc123')).toBe(true);
    expect(re?.flags).toBe('i');
  });

  it('空文字や長すぎるソースは null', () => {
    expect(compileSafePattern('')).toBeNull();
    expect(compileSafePattern('a'.repeat(MAX_PATTERN_SOURCE_LEN + 1))).toBeNull();
  });

  it('無効な RegExp（構文エラー）は null', () => {
    expect(compileSafePattern('([')).toBeNull();
    expect(compileSafePattern('a{2,1}')).toBeNull();
  });

  it('ネストした量化子（ReDoS の典型）は拒否する', () => {
    expect(compileSafePattern('(a+)+')).toBeNull();
    expect(compileSafePattern('(a*)*')).toBeNull();
    expect(compileSafePattern('(ab+)*')).toBeNull();
    expect(compileSafePattern('(x|y+)+')).toBeNull();
  });

  it('連続した量化子は拒否する', () => {
    expect(compileSafePattern('a**')).toBeNull();
    expect(compileSafePattern('a+*')).toBeNull();
  });

  it('巨大な有限量化は拒否する', () => {
    expect(compileSafePattern('a{10000,}')).toBeNull();
    expect(compileSafePattern('a{5000}')).toBeNull();
  });

  it('適度な有限量化は許可する', () => {
    expect(compileSafePattern('a{1,3}')).toBeInstanceOf(RegExp);
    expect(compileSafePattern('\\d{12}')).toBeInstanceOf(RegExp);
  });

  it('フラグは呼び出し側指定のみで、配信側ソースに依存しない', () => {
    const re = compileSafePattern('foo', 'g');
    expect(re?.global).toBe(true);
  });
});
