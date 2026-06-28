/**
 * Unit tests for the dynamic domain rule builder.
 *
 * Regression target: block/allow rules must use the domain-anchor urlFilter
 * (`||${domain}`) rather than the loose substring pattern (`*${domain}*`), so
 * adding e.g. google.com actually blocks the host and its subdomains.
 * @vitest-environment node
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// buildDomainRules references chrome.declarativeNetRequest enums at call time,
// so stub a minimal chrome before importing the module under test.
beforeAll(() => {
  vi.stubGlobal('chrome', {
    declarativeNetRequest: {
      RuleActionType: { BLOCK: 'block', ALLOW: 'allow' },
      ResourceType: {
        MAIN_FRAME: 'main_frame',
        SUB_FRAME: 'sub_frame',
        SCRIPT: 'script',
        XMLHTTPREQUEST: 'xmlhttprequest',
        IMAGE: 'image',
      },
    },
  });
});

const RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'script',
  'xmlhttprequest',
  'image',
] as unknown as chrome.declarativeNetRequest.ResourceType[];

describe('buildDomainRules', () => {
  it('uses the domain-anchor urlFilter for block rules', async () => {
    const { buildDomainRules } = await import('./domainRules');
    const rules = buildDomainRules(['google.com'], [], RESOURCE_TYPES);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.urlFilter).toBe('||google.com');
    expect(rules[0].action.type).toBe('block');
    expect(rules[0].priority).toBe(1);
  });

  it('uses the domain-anchor urlFilter for allow rules with higher priority', async () => {
    const { buildDomainRules } = await import('./domainRules');
    const rules = buildDomainRules([], ['intranet.example.com'], RESOURCE_TYPES);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.urlFilter).toBe('||intranet.example.com');
    expect(rules[0].action.type).toBe('allow');
    expect(rules[0].priority).toBe(10);
  });

  it('assigns disjoint id ranges to block and allow rules', async () => {
    const { buildDomainRules } = await import('./domainRules');
    const rules = buildDomainRules(['a.com', 'b.com'], ['c.com'], RESOURCE_TYPES);

    const ids = rules.map((r) => r.id);
    expect(ids).toEqual([10000, 10001, 20000]);
    // no loose substring patterns remain
    expect(rules.every((r) => r.condition.urlFilter?.startsWith('||'))).toBe(true);
  });
});
