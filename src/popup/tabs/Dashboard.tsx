import { MousePointerClick, EyeOff, KeyRound, Building2, Upload } from 'lucide-react';
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
  onGrantBypass,
}: DashboardProps) {
  const t = useLang();
  const locked = loading || isManaged;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t.dashboard.itemsBlocked} value={blockedCount} />
        <StatCard
          label={t.dashboard.bypass}
          value={settings.oneTimeBypass ? t.dashboard.armed : t.dashboard.off}
          accent={settings.oneTimeBypass ? 'amber' : 'emerald'}
        />
      </div>

      {/* Anti-ClickFix toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MousePointerClick className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <div className="text-sm font-semibold">{t.dashboard.antiClickFix}</div>
              <div className="text-xs text-emerald-200/60">{t.dashboard.antiClickFixDesc}</div>
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
          <div className="flex items-center gap-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <div className="text-sm font-semibold">{t.dashboard.masking}</div>
              <div className="text-xs text-emerald-200/60">{t.dashboard.maskingDesc}</div>
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
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <div className="text-sm font-semibold">{t.dashboard.sso}</div>
              <div className="text-xs text-emerald-200/60">{t.dashboard.ssoDesc}</div>
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

      {/* Trusted tenant whitelist (read-only) */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div className="text-sm font-semibold">{t.dashboard.trustedTenants}</div>
          </div>
          <span className="text-[11px] text-emerald-200/50">
            {settings.tenantWhitelist.length} {t.dashboard.entries}
          </span>
        </div>
        <TenantList entries={settings.tenantWhitelist} emptyLabel={t.dashboard.noTenants} />
      </Card>

      {/* One-Time Bypass control */}
      <Card>
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <div className="text-sm font-semibold">{t.dashboard.bypassTitle}</div>
        </div>
        <div className="mt-1 text-xs text-emerald-200/60">{t.dashboard.bypassDesc}</div>
        <button
          onClick={onGrantBypass}
          disabled={settings.oneTimeBypass !== null || isManaged}
          className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zenprax-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {settings.oneTimeBypass ? t.dashboard.bypassArmed : t.dashboard.bypassRequest}
        </button>
      </Card>
    </div>
  );
}
