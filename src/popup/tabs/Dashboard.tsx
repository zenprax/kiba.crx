import type { KibaSettings } from '../../types';
import { Card, StatCard, Toggle, TenantList } from '../Popup';

/** Props passed down from the Popup router. */
export interface DashboardProps {
  settings: KibaSettings;
  loading: boolean;
  blockedCount: number;
  onToggleAntiClickFix: () => void;
  onToggleMask: () => void;
  onToggleSso: () => void;
  onGrantBypass: () => void;
}

/** Main dashboard tab: stats, feature toggles, file-control simulator, tenants. */
export function Dashboard({
  settings,
  loading,
  blockedCount,
  onToggleAntiClickFix,
  onToggleMask,
  onToggleSso,
  onGrantBypass,
}: DashboardProps) {
  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Items Blocked" value={blockedCount} />
        <StatCard
          label="One-Time Bypass"
          value={settings.oneTimeBypass ? 'Armed' : 'Off'}
          accent={settings.oneTimeBypass ? 'amber' : 'emerald'}
        />
      </div>

      {/* Anti-ClickFix toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Anti-ClickFix</div>
            <div className="text-xs text-emerald-200/60">
              Block dangerous OS-command pastes
            </div>
          </div>
          <Toggle
            checked={settings.antiClickFixEnabled}
            disabled={loading}
            onChange={onToggleAntiClickFix}
          />
        </div>
      </Card>

      {/* Paste masking toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Confidential Masking</div>
            <div className="text-xs text-emerald-200/60">
              Mask secrets on foreign-tenant pastes
            </div>
          </div>
          <Toggle checked={settings.maskEnabled} disabled={loading} onChange={onToggleMask} />
        </div>
      </Card>

      {/* Pseudo-SSO toggle (credential list lives in the SSO tab) */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Pseudo-SSO Autofill</div>
            <div className="text-xs text-emerald-200/60">
              Hidden autofill for shared accounts
            </div>
          </div>
          <Toggle checked={settings.ssoEnabled} disabled={loading} onChange={onToggleSso} />
        </div>
      </Card>

      {/* Trusted tenant whitelist (read-only) */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Trusted Tenants</div>
          <span className="text-[11px] text-emerald-200/50">
            {settings.tenantWhitelist.length} entries
          </span>
        </div>
        <TenantList entries={settings.tenantWhitelist} />
      </Card>

      {/* One-Time Bypass control */}
      <Card>
        <div className="text-sm font-semibold">One-Time Upload Bypass</div>
        <div className="mt-1 text-xs text-emerald-200/60">
          Request a single-use upload exception for restricted domains. Approval
          is mediated by the admin console.
        </div>
        <button
          onClick={onGrantBypass}
          disabled={settings.oneTimeBypass !== null}
          className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zenprax-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {settings.oneTimeBypass
            ? 'Bypass Armed — use one upload'
            : 'Request One-Time Bypass'}
        </button>
      </Card>
    </div>
  );
}
