import {
  ClipboardX,
  FileX2,
  Unlock,
  EyeOff,
  KeyRound,
  Building2,
  Puzzle,
  Download,
  MonitorPlay,
  type LucideIcon,
} from 'lucide-react';
import type { AuditEventType, AuditLogEntry } from '../../types';
import { Card } from '../components';
import { useLang } from '../i18n';
import { AuditChart } from './AuditChart';

const EVENT_LABEL: Record<AuditEventType, string> = {
  'paste-block': 'PASTE',
  'file-block': 'FILE',
  'bypass-grant': 'BYPASS',
  'paste-mask': 'MASK',
  'sso-fill': 'SSO',
  'tenant-block': 'TENANT',
  'extension-audit': 'EXT',
  'download-block': 'DL',
  'screen-share': 'SCREEN',
};

const EVENT_ICON: Record<AuditEventType, LucideIcon> = {
  'paste-block': ClipboardX,
  'file-block': FileX2,
  'bypass-grant': Unlock,
  'paste-mask': EyeOff,
  'sso-fill': KeyRound,
  'tenant-block': Building2,
  'extension-audit': Puzzle,
  'download-block': Download,
  'screen-share': MonitorPlay,
};

// アラート色は CVSS ベースの深刻度／ステータストークンへ対応づける。
// ブロック系=critical、ファイル/マスク=medium、許可=safe、SSO=info。
// extension-audit（紫）は専用 severity トークンが無いため viz パレットで代替する。
const EVENT_COLOR: Record<AuditEventType, string> = {
  'paste-block': 'text-severity-critical-text bg-severity-critical-bg',
  'file-block': 'text-severity-medium-text bg-severity-medium-bg',
  'bypass-grant': 'text-status-safe-text bg-status-safe-bg',
  'paste-mask': 'text-severity-medium-text bg-severity-medium-bg',
  'sso-fill': 'text-status-info-text bg-status-info-bg',
  'tenant-block': 'text-severity-critical-text bg-severity-critical-bg',
  'extension-audit': 'text-viz-3 bg-bg-surface',
  // ダウンロードブロック=critical（持ち込みリスク）、画面共有=info（監査のみ）。
  'download-block': 'text-severity-critical-text bg-severity-critical-bg',
  'screen-share': 'text-status-info-text bg-status-info-bg',
};

export function AuditLog({ entries }: { entries: AuditLogEntry[] }) {
  const t = useLang();

  return (
    <div className="space-y-zp-3">
      <AuditChart entries={entries} />
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-zp-base font-semibold">{t.audit.title}</div>
          <span className="text-zp-sm text-text-muted">
            {entries.length} {t.audit.events}
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-6 text-center text-zp-md text-text-muted">
            {t.audit.noEvents}
          </div>
        ) : (
          <ul className="mt-zp-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {entries.map((e, i) => {
              const Icon = EVENT_ICON[e.type];
              return (
                <li
                  key={`${e.ts}-${i}`}
                  className="flex items-start gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-2 text-zp-md"
                >
                  <span
                    className={`mt-0.5 flex shrink-0 items-center gap-zp-1 rounded-zp-sm px-zp-1 py-0.5 text-zp-xs font-bold ${EVENT_COLOR[e.type]}`}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {EVENT_LABEL[e.type]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-text-primary">{e.detail}</div>
                    <div className="text-zp-xs text-text-muted">
                      {formatTime(e.ts)} · {e.domain || 'unknown'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
