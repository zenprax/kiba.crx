import { describe, expect, it } from 'vitest';
import type { TenantRuleDef } from '../types';
import { detectTenantByRules, hostMatches } from './tenantRules';
import { compileSafePattern, MAX_PATTERN_SOURCE_LEN } from './patternCompiler';

describe('compileSafePattern (used for tenant regex)', () => {
  it('安全なパターンを RegExp 化する', () => {
    expect(compileSafePattern('/([a-z0-9-]+)')).toBeInstanceOf(RegExp);
  });

  it('長すぎる/無効/危険なパターンは null', () => {
    expect(compileSafePattern('a'.repeat(MAX_PATTERN_SOURCE_LEN + 1))).toBeNull();
    expect(compileSafePattern('([')).toBeNull();
    expect(compileSafePattern('(a+)+')).toBeNull();
  });
});

describe('hostMatches', () => {
  it('完全一致', () => {
    expect(hostMatches('app.notion.so', 'app.notion.so')).toBe(true);
    expect(hostMatches('app.notion.so', 'www.notion.so')).toBe(false);
  });

  it('先頭ワイルドカードはサブドメインと登録ドメイン自身にマッチ', () => {
    expect(hostMatches('*.notion.so', 'app.notion.so')).toBe(true);
    expect(hostMatches('*.notion.so', 'notion.so')).toBe(true);
    expect(hostMatches('*.notion.so', 'notion.so.evil.com')).toBe(false);
  });
});

describe('detectTenantByRules', () => {
  const notionRule: TenantRuleDef = {
    provider: 'notion',
    hostMatch: '*.notion.so',
    extract: { source: 'pathname', regex: '/([a-z0-9]+)', group: 1 },
  };

  it('マッチするルールで tenantId を抽出する', () => {
    const ctx = detectTenantByRules('https://app.notion.so/myworkspace/page', [notionRule]);
    expect(ctx).toEqual({ provider: 'notion', tenantId: 'myworkspace', hostname: 'app.notion.so' });
  });

  it('ホストがマッチしなければ unknown', () => {
    const ctx = detectTenantByRules('https://example.com/x', [notionRule]);
    expect(ctx.provider).toBe('unknown');
  });

  it('危険な regex のルールはスキップして unknown へ', () => {
    const badRule: TenantRuleDef = {
      provider: 'bad',
      hostMatch: 'bad.example.com',
      extract: { source: 'pathname', regex: '(a+)+', group: 1 },
    };
    const ctx = detectTenantByRules('https://bad.example.com/x', [badRule]);
    expect(ctx.provider).toBe('unknown');
  });

  it('不正な URL でも throw しない', () => {
    expect(detectTenantByRules('not a url', [notionRule]).provider).toBe('unknown');
  });

  it('hostname を抽出元にもできる', () => {
    const rule: TenantRuleDef = {
      provider: 'acme',
      hostMatch: '*.acme.io',
      extract: { source: 'hostname', regex: '^([a-z0-9]+)\\.acme\\.io$', group: 1 },
    };
    const ctx = detectTenantByRules('https://team1.acme.io/dashboard', [rule]);
    expect(ctx.tenantId).toBe('team1');
  });
});
