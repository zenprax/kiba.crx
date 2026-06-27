import { describe, expect, it } from 'vitest';
import type { TenantWhitelistEntry } from '../types';
import {
  detectTenant,
  extractGithubOrg,
  extractGoogleAccount,
  extractSlackWorkspace,
  isTrustedTenant,
} from './tenantDetector';

describe('extractSlackWorkspace', () => {
  it('extracts the workspace id from a client URL', () => {
    expect(extractSlackWorkspace('/client/T0ZENPRAX/C12345678')).toBe('T0ZENPRAX');
  });

  it('returns null when no workspace segment is present', () => {
    expect(extractSlackWorkspace('/signin')).toBeNull();
  });
});

describe('extractGoogleAccount', () => {
  it('combines host root with the account index', () => {
    expect(extractGoogleAccount('/u/0/inbox', 'mail.google.com')).toBe('google.com:0');
  });

  it('returns null when no /u/{N}/ segment exists', () => {
    expect(extractGoogleAccount('/mail/inbox', 'mail.google.com')).toBeNull();
  });
});

describe('extractGithubOrg', () => {
  it('extracts an org from /orgs/{org}', () => {
    expect(extractGithubOrg('/orgs/zenprax/people')).toBe('zenprax');
  });

  it('extracts an enterprise from /enterprises/{ent}', () => {
    expect(extractGithubOrg('/enterprises/acme/settings')).toBe('acme');
  });

  it('falls back to the first owner segment', () => {
    expect(extractGithubOrg('/zenprax/kiba.crx')).toBe('zenprax');
  });

  it('ignores reserved routes like /login', () => {
    expect(extractGithubOrg('/login')).toBeNull();
  });
});

describe('detectTenant', () => {
  it('identifies a Slack workspace', () => {
    const ctx = detectTenant('https://app.slack.com/client/T9OTHER01/C0AAAAAA');
    expect(ctx).toEqual({ provider: 'slack', tenantId: 'T9OTHER01', hostname: 'app.slack.com' });
  });

  it('identifies a Google account context', () => {
    const ctx = detectTenant('https://mail.google.com/u/1/');
    expect(ctx).toEqual({ provider: 'google', tenantId: 'google.com:1', hostname: 'mail.google.com' });
  });

  it('identifies a GitHub org', () => {
    const ctx = detectTenant('https://github.com/orgs/zenprax/repositories');
    expect(ctx).toEqual({ provider: 'github', tenantId: 'zenprax', hostname: 'github.com' });
  });

  it('returns unknown for unrelated hosts', () => {
    const ctx = detectTenant('https://example.com/path');
    expect(ctx.provider).toBe('unknown');
    expect(ctx.tenantId).toBeNull();
  });

  it('does not throw on invalid URLs', () => {
    expect(() => detectTenant('not a url')).not.toThrow();
    expect(detectTenant('not a url')).toEqual({ provider: 'unknown', tenantId: null, hostname: '' });
  });

  it('OTA ルールがマッチすれば組み込み判定より優先する', () => {
    const rules = [
      {
        provider: 'notion',
        hostMatch: '*.notion.so',
        extract: { source: 'pathname' as const, regex: '/([a-z0-9-]+)', group: 1 },
      },
    ];
    const ctx = detectTenant('https://app.notion.so/team-x/page', rules);
    expect(ctx).toEqual({ provider: 'notion', tenantId: 'team-x', hostname: 'app.notion.so' });
  });

  it('OTA ルールにマッチしなければ組み込み判定にフォールバックする', () => {
    const rules = [
      {
        provider: 'notion',
        hostMatch: '*.notion.so',
        extract: { source: 'pathname' as const, regex: '/([a-z0-9]+)', group: 1 },
      },
    ];
    // Slack URL は notion ルールにマッチしないので組み込み Slack 判定が効く。
    const ctx = detectTenant('https://app.slack.com/client/T0ZENPRAX/C1', rules);
    expect(ctx).toEqual({ provider: 'slack', tenantId: 'T0ZENPRAX', hostname: 'app.slack.com' });
  });
});

describe('isTrustedTenant', () => {
  const whitelist: TenantWhitelistEntry[] = [
    { provider: 'slack', tenantId: 'T0ZENPRAX', label: 'Zenprax Slack' },
    { provider: 'github', tenantId: 'zenprax', label: 'Zenprax GitHub' },
  ];

  it('trusts an in-house tenant on a matching provider', () => {
    expect(
      isTrustedTenant({ provider: 'slack', tenantId: 'T0ZENPRAX', hostname: 'app.slack.com' }, whitelist),
    ).toBe(true);
  });

  it('restricts a foreign tenant on a known provider', () => {
    expect(
      isTrustedTenant({ provider: 'slack', tenantId: 'T9OTHER01', hostname: 'app.slack.com' }, whitelist),
    ).toBe(false);
  });

  it('restricts when the tenant id could not be extracted (fail safe)', () => {
    expect(
      isTrustedTenant({ provider: 'github', tenantId: null, hostname: 'github.com' }, whitelist),
    ).toBe(false);
  });

  it('does not restrict unknown providers (host-fallback handles them)', () => {
    expect(
      isTrustedTenant({ provider: 'unknown', tenantId: null, hostname: 'example.com' }, whitelist),
    ).toBe(true);
  });
});
