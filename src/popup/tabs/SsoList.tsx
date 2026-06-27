import { KeyRound } from 'lucide-react';
import { Card } from '../Popup';
import { useLang } from '../i18n';

export interface SsoListProps {
  configured: boolean;
  count: number;
}

export function SsoList({ configured, count }: SsoListProps) {
  const t = useLang();

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div className="text-sm font-semibold">{t.sso.title}</div>
          </div>
          <span className="text-[11px] text-emerald-200/50">
            {count} {t.sso.synced}
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-200/60">{t.sso.desc}</p>
        {!configured ? (
          <div className="mt-3 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
            {t.sso.notConfigured}
          </div>
        ) : count === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
            {t.sso.noCredentials}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-zenprax-950/60 px-2.5 py-2 text-xs text-emerald-200/70">
            {t.sso.countSynced(count)}
          </div>
        )}
      </Card>
    </div>
  );
}
