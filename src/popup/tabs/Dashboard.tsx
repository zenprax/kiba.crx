import { useState } from 'react';
import {
  MousePointerClick,
  EyeOff,
  KeyRound,
  Building2,
  Upload,
  ShieldAlert,
  Download,
  MonitorPlay,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { KibaSettings, TabId } from '../../types';
import { Card, StatCard, TenantList, SiteSegmentCard, FeatureToggleCard } from '../components';
import { useLang } from '../i18n';

/** Props for the main dashboard tab. */
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

/** Main dashboard tab showing feature toggles, bypass control, and tenant list. */
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
      <SiteSegmentCard
        settings={settings}
        isManaged={isManaged}
        onUpdateSettings={onUpdateSettings}
      />

      {/* Primary features (always visible) */}
      <FeatureToggleCard
        icon={MousePointerClick}
        title={t.dashboard.antiClickFix}
        description={t.dashboard.antiClickFixDesc}
        checked={settings.antiClickFixEnabled}
        disabled={locked}
        onChange={onToggleAntiClickFix}
        label="Anti-ClickFix"
      />

      <FeatureToggleCard
        icon={EyeOff}
        title={t.dashboard.masking}
        description={t.dashboard.maskingDesc}
        checked={settings.maskEnabled}
        disabled={locked}
        onChange={onToggleMask}
        label="Confidential Masking"
      />

      <FeatureToggleCard
        icon={ShieldAlert}
        title={t.dashboard.networkFilter}
        description={t.dashboard.networkFilterDesc}
        checked={settings.networkFilterEnabled}
        disabled={locked}
        onChange={onToggleNetworkFilter}
        label="Threat Intelligence Filter"
      />

      {/* Secondary features (collapsible) */}
      <button
        onClick={() => setSecondaryOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-zp-lg border border-border-default bg-bg-surface/40 px-zp-3 py-zp-2 text-zp-md font-semibold text-text-muted hover:text-text-secondary transition"
      >
        <span>その他の保護機能</span>
        {secondaryOpen ? (
          <ChevronUp className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden />
        )}
      </button>

      {secondaryOpen && (
        <div className="space-y-zp-3">
          <FeatureToggleCard
            icon={KeyRound}
            title={t.dashboard.sso}
            description={t.dashboard.ssoDesc}
            checked={settings.ssoEnabled}
            disabled={locked}
            onChange={onToggleSso}
            label="Pseudo-SSO Autofill"
          />

          <FeatureToggleCard
            icon={Download}
            title={t.download.enable}
            description={t.download.enableDesc}
            checked={settings.downloadGaterEnabled}
            disabled={locked}
            onChange={onToggleDownloadGater}
            label="Download Gater"
          />

          <FeatureToggleCard
            icon={MonitorPlay}
            title={t.screenShare.enable}
            description={t.screenShare.enableDesc}
            checked={settings.screenShareAuditEnabled}
            disabled={locked}
            onChange={onToggleScreenShareAudit}
            label="Screen Share Audit"
          />
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
                {t.dashboard.bypassExpiry(
                  Math.max(0, Math.round((settings.oneTimeBypass.expiresAt - Date.now()) / 60000)),
                )}
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
