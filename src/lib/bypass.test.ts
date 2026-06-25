import { describe, expect, it } from 'vitest';
import { consumeBypass, isBypassValid, makeGrant } from './bypass';
import type { BypassGrant } from '../types';

const NOW = 1_000_000;

function grant(overrides: Partial<BypassGrant> = {}): BypassGrant {
  return {
    id: 'g1',
    domain: 'example.com',
    grantedAt: NOW,
    expiresAt: NOW + 60_000,
    remainingUses: 1,
    ...overrides,
  };
}

describe('isBypassValid', () => {
  it('TTL 内・残回数あり・domain 一致なら true', () => {
    expect(isBypassValid(grant(), 'example.com', NOW)).toBe(true);
  });

  it('null は false', () => {
    expect(isBypassValid(null, 'example.com', NOW)).toBe(false);
  });

  it('domain 不一致は false', () => {
    expect(isBypassValid(grant(), 'other.com', NOW)).toBe(false);
  });

  it('残回数 0 は false', () => {
    expect(isBypassValid(grant({ remainingUses: 0 }), 'example.com', NOW)).toBe(false);
  });

  it('失効済み（expiresAt <= now）は false', () => {
    expect(isBypassValid(grant({ expiresAt: NOW }), 'example.com', NOW)).toBe(false);
  });
});

describe('consumeBypass', () => {
  it('残 1 を消費すると null になる', () => {
    expect(consumeBypass(grant({ remainingUses: 1 }), NOW)).toBeNull();
  });

  it('残 2 を消費すると残 1 のレコードを返す', () => {
    const next = consumeBypass(grant({ remainingUses: 2 }), NOW);
    expect(next?.remainingUses).toBe(1);
  });

  it('失効済みは消費しても null', () => {
    expect(consumeBypass(grant({ expiresAt: NOW }), NOW)).toBeNull();
  });
});

describe('makeGrant', () => {
  it('TTL を適用した単回付与を生成する', () => {
    const g = makeGrant('id-1', 'example.com', 30_000, NOW);
    expect(g).toEqual({
      id: 'id-1',
      domain: 'example.com',
      grantedAt: NOW,
      expiresAt: NOW + 30_000,
      remainingUses: 1,
    });
  });
});
