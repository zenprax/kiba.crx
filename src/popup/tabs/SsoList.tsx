import { KeyRound } from 'lucide-react';
import { Card } from '../components';
import { useLang } from '../i18n';

/** Props for SsoList. */
export interface SsoListProps {
  configured: boolean;
  count: number;
}

/** Tab displaying pseudo-SSO credential configuration status. */
export function SsoList({ configured, count }: SsoListProps) {
  const t = useLang();

  return (
    <div className="space-y-zp-3">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <KeyRound className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div className="text-zp-base font-semibold">{t.sso.title}</div>
          </div>
          <span className="text-zp-sm text-text-muted">
            {count} {t.sso.synced}
          </span>
        </div>
        <p className="mt-zp-1 text-zp-md text-text-muted">{t.sso.desc}</p>
        {!configured ? (
          <div className="mt-zp-3 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-sm text-text-muted">
            {t.sso.notConfigured}
          </div>
        ) : count === 0 ? (
          <div className="mt-zp-3 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-sm text-text-muted">
            {t.sso.noCredentials}
          </div>
        ) : (
          <div className="mt-zp-3 rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-2 text-zp-md text-text-secondary">
            {t.sso.countSynced(count)}
          </div>
        )}
      </Card>
    </div>
  );
}
