import { useEffect, useState, type ReactNode } from 'react';
import { Globe, Shield, ShieldOff } from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card } from './Card';
import { useLang } from '../i18n';

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Three-state segment control: default / allow / block */
type SiteState = 'default' | 'allow' | 'block';

/** Three-state site control: allow / block current hostname via network-filter rules. */
export function SiteSegmentCard({
  settings,
  isManaged,
  onUpdateSettings,
}: {
  settings: KibaSettings;
  isManaged: boolean;
  onUpdateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}) {
  const t = useLang();
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => setHost(tab?.url ? hostnameOf(tab.url) : null))
      .catch(() => setHost(null));
  }, []);

  const siteState: SiteState =
    host !== null && settings.userBlockDomains.includes(host)
      ? 'block'
      : host !== null && settings.filterAllowlist.includes(host)
        ? 'allow'
        : 'default';

  async function applyState(next: SiteState) {
    if (!host || isManaged) return;
    const blockList = settings.userBlockDomains.filter((d) => d !== host);
    const allowList = settings.filterAllowlist.filter((d) => d !== host);
    if (next === 'block') blockList.push(host);
    if (next === 'allow') allowList.push(host);
    await onUpdateSettings({ userBlockDomains: blockList, filterAllowlist: allowList });
  }

  const stateDesc: Record<SiteState, string> = {
    default: 'システム既定のルールを適用中',
    allow: 'このサイトはすべてのブロックルールから除外されています',
    block: 'このサイトへのリクエストをブロックしています',
  };

  const segments: { id: SiteState; label: string; icon: ReactNode }[] = [
    { id: 'default', label: 'デフォルト', icon: <Globe className="h-3.5 w-3.5" aria-hidden /> },
    { id: 'allow', label: '許可中', icon: <Shield className="h-3.5 w-3.5" aria-hidden /> },
    { id: 'block', label: 'ブロック', icon: <ShieldOff className="h-3.5 w-3.5" aria-hidden /> },
  ];

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <Globe className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.dashboard.quickActions.title}</div>
      </div>

      {host ? (
        <>
          <div className="mt-zp-1 rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-1 text-zp-md">
            <span className="text-text-muted">{t.dashboard.quickActions.currentSite}: </span>
            <span className="font-mono text-text-primary">{host}</span>
          </div>

          <div className="mt-zp-2 flex rounded-zp-lg border border-border-default overflow-hidden">
            {segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => void applyState(seg.id)}
                disabled={isManaged}
                className={`flex flex-1 items-center justify-center gap-zp-1 py-zp-2 text-zp-sm font-semibold transition
                  ${
                    siteState === seg.id
                      ? seg.id === 'block'
                        ? 'bg-interactive-segment-block-bg text-interactive-segment-block-text'
                        : seg.id === 'allow'
                          ? 'bg-interactive-segment-allow-bg text-interactive-segment-allow-text'
                          : 'bg-interactive-segment-default-bg text-interactive-segment-default-text'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-base/40'
                  }
                  disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {seg.icon}
                {seg.label}
              </button>
            ))}
          </div>

          <p className="mt-zp-1 text-zp-xs text-text-muted">{stateDesc[siteState]}</p>
        </>
      ) : (
        <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-md text-text-muted">
          {t.dashboard.quickActions.noActiveTab}
        </div>
      )}
    </Card>
  );
}
