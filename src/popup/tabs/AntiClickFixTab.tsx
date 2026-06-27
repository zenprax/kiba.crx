import { ShieldCheck, Terminal } from 'lucide-react';
import { Card } from '../Popup';
import { useLang } from '../i18n';

export function AntiClickFixTab() {
  const t = useLang();

  return (
    <div className="space-y-zp-3">
      <Card>
        <div className="flex items-center gap-zp-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <div className="text-zp-base font-semibold">{t.antiClickFix.title}</div>
        </div>
        <p className="mt-zp-2 text-zp-md text-text-muted">{t.antiClickFix.desc}</p>
        <ul className="mt-zp-3 space-y-1.5">
          {t.antiClickFix.patterns.map((pattern) => (
            <li
              key={pattern}
              className="flex items-center gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2"
            >
              <Terminal className="h-3.5 w-3.5 shrink-0 text-status-warn-text" aria-hidden />
              <span className="font-mono text-zp-md text-text-primary">{pattern}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
