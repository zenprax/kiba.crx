import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '../../types';
import { summarizeAuditEvents } from './AuditChart';

function entry(type: AuditLogEntry['type']): AuditLogEntry {
  return { ts: Date.now(), type, detail: 'x', domain: 'example.com' };
}

describe('summarizeAuditEvents', () => {
  it('空配列なら空', () => {
    expect(summarizeAuditEvents([])).toEqual([]);
  });

  it('type 別に集計し件数の多い順に並べる', () => {
    const entries = [
      entry('paste-block'),
      entry('paste-block'),
      entry('paste-block'),
      entry('file-block'),
      entry('sso-fill'),
      entry('sso-fill'),
    ];
    expect(summarizeAuditEvents(entries)).toEqual([
      { type: 'paste-block', count: 3 },
      { type: 'sso-fill', count: 2 },
      { type: 'file-block', count: 1 },
    ]);
  });

  it('0 件の type は含めない', () => {
    const result = summarizeAuditEvents([entry('download-block')]);
    expect(result).toEqual([{ type: 'download-block', count: 1 }]);
  });
});
