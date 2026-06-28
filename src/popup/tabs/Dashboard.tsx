import { useEffect, useState, type ReactNode } from 'react';
import {
  MousePointerClick,
  EyeOff,
  KeyRound,
  Building2,
  Upload,
  ShieldAlert,
  Download,
  MonitorPlay,
  Globe,
  Shield,
  ShieldOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { KibaSettings, TabId } from '../../types';
import { Card, StatCard, Toggle, TenantList } from '../Popup';
import { useLang } from '../i18n';

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface DashboardProps {
  settings: KibaSettings;
  loading: boolean;
  isManaged: boolean;
  blockedCount: number;
  onToggleAntiClickFix: () => void;
  onToggleMask: () => void;
  onToggleSso: () => void;
  onToggleNetworkFilter: () => void;
  onToggleDownloadGater: () => void;
  onToggleScreenShareAudit: () => void;
  onGrantBypass: () => void;
  onUpdateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
  onNavigate: (tab: TabId) => void;
}

export function Dashboard({
  settings,
  loading,
  isManaged,
  blockedCount,
  onToggleAntiClickFix,
  onToggleMask,
  onToggleSso,
  onToggleNetworkFilter,
  onToggleDownloadGater,
  onToggleScreenShareAudit,
  onGrantBypass,
  onUpdateSettings,
  onNavigate,
}: DashboardProps) {
  const t = useLang();
  const locked = loading || isManaged;
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  return (
    <div className="space-y-zp-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-zp-3">
        <StatCard label={t.dashboard.itemsBlocked} value={blockedCount} />
        <StatCard
          label={t.dashboard.bypass}
          value={settings.oneTimeBypass ? t.dashboard.armed : t.dashboard.off}
          accent={settings.oneTimeBypass ? 'warn' : 'brand'}
        />
      </div>

      {/* Site segment control */}
      <SiteSegmentCard settings={settings} isManaged={isManaged} onUpdateSettings={onUpdateSettings} />

      {/* Primary features (always visible) */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <MousePointerClick className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.antiClickFix}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.antiClickFixDesc}</div>
            </div>
          </div>
          <Toggle checked={settings.antiClickFixEnabled} disabled={locked} onChange={onToggleAntiClickFix} label="Anti-ClickFix" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <EyeOff className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.masking}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.maskingDesc}</div>
            </div>
          </div>
          <Toggle checked={settings.maskEnabled} disabled={locked} onChange={onToggleMask} label="Confidential Masking" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.networkFilter}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.networkFilterDesc}</div>
            </div>
          </div>
          <Toggle checked={settings.networkFilterEnabled} disabled={locked} onChange={onToggleNetworkFilter} label="Threat Intelligence Filter" />
        </div>
      </Card>

      {/* Secondary features (collapsible) */}
      <button
        onClick={() => setSecondaryOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-zp-lg border border-border-default bg-bg-surface/40 px-zp-3 py-zp-2 text-zp-md font-semibold text-text-muted hover:text-text-secondary transition"
      >
        <span>その他の保護機能</span>
        {secondaryOpen
          ? <ChevronUp className="h-4 w-4" aria-hidden />
          : <ChevronDown className="h-4 w-4" aria-hidden />
        }
      </button>

      {secondaryOpen && (
        <div className="space-y-zp-3">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-zp-2">
                <KeyRound className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                <div>
                  <div className="text-zp-base font-semibold">{t.dashboard.sso}</div>
                  <div className="text-zp-md text-text-muted">{t.dashboard.ssoDesc}</div>
                </div>
              </div>
              <Toggle checked={settings.ssoEnabled} disabled={locked} onChange={onToggleSso} label="Pseudo-SSO Autofill" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-zp-2">
                <Download className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                <div>
                  <div className="text-zp-base font-semibold">{t.download.enable}</div>
                  <div className="text-zp-md text-text-muted">{t.download.enableDesc}</div>
                </div>
              </div>
              <Toggle checked={settings.downloadGaterEnabled} disabled={locked} onChange={onToggleDownloadGater} label="Download Gater" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-zp-2">
                <MonitorPlay className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                <div>
                  <div className="text-zp-base font-semibold">{t.screenShare.enable}</div>
                  <div className="text-zp-md text-text-muted">{t.screenShare.enableDesc}</div>
                </div>
              </div>
              <Toggle checked={settings.screenShareAuditEnabled} disabled={locked} onChange={onToggleScreenShareAudit} label="Screen Share Audit" />
            </div>
          </Card>
        </div>
      )}

      {/* Trusted tenant whitelist (read-only) */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <Building2 className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div className="text-zp-base font-semibold">{t.dashboard.trustedTenants}</div>
          </div>
          <span className="text-zp-sm text-text-muted">
            {settings.tenantWhitelist.length} {t.dashboard.entries}
          </span>
        </div>
        <TenantList
          entries={settings.tenantWhitelist}
          emptyLabel={t.dashboard.noTenants}
          onNavigateToSettings={() => onNavigate('settings')}
        />
      </Card>

      {/* One-Time Bypass control */}
      <Card>
        <div className="flex items-center gap-zp-2">
          <Upload className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <div className="text-zp-base font-semibold">{t.dashboard.bypassTitle}</div>
        </div>
        <div className="mt-zp-1 text-zp-md text-text-muted">{t.dashboard.bypassDesc}</div>
        {settings.oneTimeBypass && (
          <div className="mt-zp-2 rounded-zp-lg border border-status-warn-text/30 bg-status-warn-bg/20 px-zp-2 py-zp-2 text-zp-sm space-y-zp-1">
            <div className="flex items-center justify-between gap-zp-2">
              <span className="text-text-muted">{t.dashboard.bypassDomain}</span>
              <span className="font-mono text-text-primary">{settings.oneTimeBypass.domain}</span>
            </div>
            <div className="flex items-center justify-between gap-zp-2">
              <span className="text-text-muted">{t.dashboard.bypassArmed}</span>
              <span className="text-status-warn-text font-semibold">
                {t.dashboard.bypassExpiry(Math.max(0, Math.round((settings.oneTimeBypass.expiresAt - Date.now()) / 60000)))}
              </span>
            </div>
          </div>
        )}
        <div className="mt-zp-3 flex gap-zp-2">
          <button
            onClick={onGrantBypass}
            disabled={settings.oneTimeBypass !== null || isManaged}
            className="flex-1 rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settings.oneTimeBypass ? t.dashboard.bypassArmed : t.dashboard.bypassRequest}
          </button>
          {settings.oneTimeBypass && (
            <button
              onClick={() => void onUpdateSettings({ oneTimeBypass: null })}
              disabled={isManaged}
              className="rounded-zp-lg border border-btn-danger-bg px-zp-3 py-zp-2 text-zp-base font-semibold text-btn-danger-bg transition hover:bg-btn-danger-bg hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.dashboard.bypassRevoke}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

/** 3状態セグメントコントロール: default / allow / block */
type SiteState = 'default' | 'allow' | 'block';

function SiteSegmentCard({
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
    allow:   'このサイトはすべてのブロックルールから除外されています',
    block:   'このサイトへのリクエストをブロックしています',
  };

  const segments: { id: SiteState; label: string; icon: ReactNode }[] = [
    { id: 'default', label: 'デフォルト', icon: <Globe className="h-3.5 w-3.5" aria-hidden /> },
    { id: 'allow',   label: '許可中',     icon: <Shield className="h-3.5 w-3.5" aria-hidden /> },
    { id: 'block',   label: 'ブロック',   icon: <ShieldOff className="h-3.5 w-3.5" aria-hidden /> },
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
                  ${siteState === seg.id
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

