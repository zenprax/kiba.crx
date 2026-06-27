import {
  ClipboardX,
  FileX2,
  Unlock,
  EyeOff,
  KeyRound,
  Building2,
  Puzzle,
  type LucideIcon,
} from 'lucide-react';
import type { AuditEventType, AuditLogEntry } from '../../types';
import { Card } from '../Popup';
import { useLang } from '../i18n';

const EVENT_LABEL: Record<AuditEventType, string> = {
  'paste-block': 'PASTE',
  'file-block': 'FILE',
  'bypass-grant': 'BYPASS',
  'paste-mask': 'MASK',
  'sso-fill': 'SSO',
  'tenant-block': 'TENANT',
  'extension-audit': 'EXT',
};

const EVENT_ICON: Record<AuditEventType, LucideIcon> = {
  'paste-block': ClipboardX,
  'file-block': FileX2,
  'bypass-grant': Unlock,
  'paste-mask': EyeOff,
  'sso-fill': KeyRound,
  'tenant-block': Building2,
  'extension-audit': Puzzle,
};

const EVENT_COLOR: Record<AuditEventType, string> = {
  'paste-block': 'text-rose-300 bg-rose-500/10',
  'file-block': 'text-amber-300 bg-amber-500/10',
  'bypass-grant': 'text-emerald-300 bg-emerald-500/10',
  'paste-mask': 'text-amber-300 bg-amber-500/10',
  'sso-fill': 'text-sky-300 bg-sky-500/10',
  'tenant-block': 'text-rose-300 bg-rose-500/10',
  'extension-audit': 'text-violet-300 bg-violet-500/10',
};

export function AuditLog({ entries }: { entries: AuditLogEntry[] }) {
  const t = useLang();

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{t.audit.title}</div>
          <span className="text-[11px] text-emerald-200/50">
            {entries.length} {t.audit.events}
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-emerald-500/15 py-6 text-center text-xs text-emerald-200/40">
            {t.audit.noEvents}
          </div>
        ) : (
          <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {entries.map((e, i) => {
              const Icon = EVENT_ICON[e.type];
              return (
                <li
                  key={`${e.ts}-${i}`}
                  className="flex items-start gap-2 rounded-lg bg-zenprax-950/60 px-2.5 py-2 text-xs"
                >
                  <span
                    className={`mt-0.5 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${EVENT_COLOR[e.type]}`}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {EVENT_LABEL[e.type]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-emerald-50">{e.detail}</div>
                    <div className="text-[10px] text-emerald-200/40">
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
