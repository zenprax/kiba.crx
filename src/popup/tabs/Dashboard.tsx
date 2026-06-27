import {
  MousePointerClick,
  EyeOff,
  KeyRound,
  Building2,
  Upload,
  ShieldAlert,
  MonitorPlay,
} from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card, StatCard, Toggle, TenantList } from '../Popup';
import { useLang } from '../i18n';

export interface DashboardProps {
  settings: KibaSettings;
  loading: boolean;
  isManaged: boolean;
  blockedCount: number;
  onToggleAntiClickFix: () => void;
  onToggleMask: () => void;
  onToggleSso: () => void;
  onToggleNetworkFilter: () => void;
  onToggleScreenShareAudit: () => void;
  onGrantBypass: () => void;
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
  onToggleScreenShareAudit,
  onGrantBypass,
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
