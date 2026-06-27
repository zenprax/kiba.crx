import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card, StatCard, Toggle, TenantList } from '../Popup';
import { useLang } from '../i18n';

/** URL 文字列をホスト名に正規化する（FilterTab の入力正規化と整合）。 */
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
}: DashboardProps) {
  const t = useLang();
  const locked = loading || isManaged;

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

      {/* このサイトをワンクリックで許可/ブロック */}
      <QuickActionsCard settings={settings} isManaged={isManaged} onUpdateSettings={onUpdateSettings} />

      {/* Anti-ClickFix toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <MousePointerClick className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.antiClickFix}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.antiClickFixDesc}</div>
            </div>
          </div>
          <Toggle
            checked={settings.antiClickFixEnabled}
            disabled={locked}
            onChange={onToggleAntiClickFix}
            label="Anti-ClickFix"
          />
        </div>
      </Card>

      {/* Paste masking toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <EyeOff className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.masking}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.maskingDesc}</div>
            </div>
          </div>
          <Toggle
            checked={settings.maskEnabled}
            disabled={locked}
            onChange={onToggleMask}
            label="Confidential Masking"
          />
        </div>
      </Card>

      {/* Pseudo-SSO toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <KeyRound className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.sso}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.ssoDesc}</div>
            </div>
          </div>
          <Toggle
            checked={settings.ssoEnabled}
            disabled={locked}
            onChange={onToggleSso}
            label="Pseudo-SSO Autofill"
          />
        </div>
      </Card>

      {/* Threat Intelligence Filter toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.dashboard.networkFilter}</div>
              <div className="text-zp-md text-text-muted">{t.dashboard.networkFilterDesc}</div>
            </div>
          </div>
          <Toggle
            checked={settings.networkFilterEnabled}
            disabled={locked}
            onChange={onToggleNetworkFilter}
            label="Threat Intelligence Filter"
          />
        </div>
      </Card>

      {/* Download Gater toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <Download className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.download.enable}</div>
              <div className="text-zp-md text-text-muted">{t.download.enableDesc}</div>
            </div>
          </div>
          <Toggle
            checked={settings.downloadGaterEnabled}
            disabled={locked}
            onChange={onToggleDownloadGater}
            label="Download Gater"
          />
        </div>
      </Card>

      {/* Screen-share audit toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-zp-2">
            <MonitorPlay className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
            <div>
              <div className="text-zp-base font-semibold">{t.screenShare.enable}</div>
              <div className="text-zp-md text-text-muted">{t.screenShare.enableDesc}</div>
            </div>
          </div>
          <Toggle
            checked={settings.screenShareAuditEnabled}
            disabled={locked}
            onChange={onToggleScreenShareAudit}
            label="Screen Share Audit"
          />
        </div>
      </Card>

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
        <TenantList entries={settings.tenantWhitelist} emptyLabel={t.dashboard.noTenants} />
      </Card>

      {/* One-Time Bypass control */}
      <Card>
        <div className="flex items-center gap-zp-2">
          <Upload className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <div className="text-zp-base font-semibold">{t.dashboard.bypassTitle}</div>
        </div>
        <div className="mt-zp-1 text-zp-md text-text-muted">{t.dashboard.bypassDesc}</div>
        <button
          onClick={onGrantBypass}
          disabled={settings.oneTimeBypass !== null || isManaged}
          className="mt-zp-3 w-full rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {settings.oneTimeBypass ? t.dashboard.bypassArmed : t.dashboard.bypassRequest}
        </button>
      </Card>
    </div>
  );
}

/**
 * 現在アクティブなタブのホストを取得し、ワンクリックで block/allow リストに
 * 追加するカード。chrome.tabs.query は grantBypass と同じパターンで使う。
 */
function QuickActionsCard({
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

  const inBlock = host !== null && settings.userBlockDomains.includes(host);
  const inAllow = host !== null && settings.filterAllowlist.includes(host);

  async function addToBlock() {
    if (!host || inBlock) return;
    await onUpdateSettings({ userBlockDomains: [...settings.userBlockDomains, host] });
  }

  async function addToAllow() {
    if (!host || inAllow) return;
    await onUpdateSettings({ filterAllowlist: [...settings.filterAllowlist, host] });
  }

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <Globe className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.dashboard.quickActions.title}</div>
      </div>
      <div className="mt-zp-1 text-zp-md text-text-muted">{t.dashboard.quickActions.desc}</div>

      {host ? (
        <>
          <div className="mt-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2 text-zp-md">
            <span className="text-text-muted">{t.dashboard.quickActions.currentSite}: </span>
            <span className="font-mono text-text-primary">{host}</span>
          </div>
          <div className="mt-zp-2 grid grid-cols-2 gap-zp-2">
            <button
              onClick={() => void addToBlock()}
              disabled={isManaged || inBlock}
              className="flex items-center justify-center gap-zp-1 rounded-zp-lg bg-btn-danger-bg px-zp-3 py-zp-2 text-zp-md font-semibold text-text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldOff className="h-3.5 w-3.5" aria-hidden />
              {t.dashboard.quickActions.block}
            </button>
            <button
              onClick={() => void addToAllow()}
              disabled={isManaged || inAllow}
              className="flex items-center justify-center gap-zp-1 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2 text-zp-md font-semibold text-text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shield className="h-3.5 w-3.5" aria-hidden />
              {t.dashboard.quickActions.allow}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-md text-text-muted">
          {t.dashboard.quickActions.noActiveTab}
        </div>
      )}
    </Card>
  );
}
