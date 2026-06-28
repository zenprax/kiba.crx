import { ShieldCheck, Terminal, Sparkles } from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card } from '../components';
import { useLang } from '../i18n';

export function AntiClickFixTab({ settings }: { settings: KibaSettings }) {
  const t = useLang();
  const customDanger = settings.customPatterns?.danger ?? [];
  const customSecrets = settings.customPatterns?.secrets ?? [];
  const hasCustom = customDanger.length > 0 || customSecrets.length > 0;

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

      {/* 組織が OTA 配信したカスタムパターン（あれば表示）。 */}
      <Card>
        <div className="flex items-center gap-zp-2">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <div className="text-zp-base font-semibold">{t.antiClickFix.customTitle}</div>
        </div>
        <p className="mt-zp-2 text-zp-md text-text-muted">{t.antiClickFix.customDesc}</p>
        {hasCustom ? (
          <ul className="mt-zp-3 space-y-1.5">
            {customDanger.map((src, i) => (
              <li
                key={`danger-${i}`}
                className="flex items-center gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2"
              >
                <span className="shrink-0 rounded-zp-sm bg-severity-critical-bg px-zp-1 py-0.5 text-zp-xs font-bold text-severity-critical-text">
                  DANGER
                </span>
                <span className="truncate font-mono text-zp-md text-text-primary">{src}</span>
              </li>
            ))}
            {customSecrets.map((s, i) => (
              <li
                key={`secret-${i}`}
                className="flex items-center gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2"
              >
                <span className="shrink-0 rounded-zp-sm bg-severity-medium-bg px-zp-1 py-0.5 text-zp-xs font-bold text-severity-medium-text">
                  {s.label}
                </span>
                <span className="truncate font-mono text-zp-md text-text-primary">{s.pattern}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-zp-3 rounded-zp-lg border border-dashed border-border-default py-zp-4 text-center text-zp-md text-text-muted">
            {t.antiClickFix.noCustom}
          </div>
        )}
      </Card>
    </div>
  );
}
