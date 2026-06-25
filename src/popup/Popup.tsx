import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_SETTINGS,
  type KibaSettings,
  type TenantWhitelistEntry,
} from '../types';
import { getSettings, onSettingsChanged, setSettings } from '../lib/storage';
import { Dashboard } from './tabs/Dashboard';
import { SsoList } from './tabs/SsoList';
import { AuditLog } from './tabs/AuditLog';

/** Identifiers for the top-level popup tabs. */
type TabId = 'dashboard' | 'sso' | 'audit';

/** Admin/User local dashboard for kiba.crx. */
export function Popup() {
  const [settings, setLocalSettings] = useState<KibaSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  useEffect(() => {
    void getSettings().then((s) => {
      setLocalSettings(s);
      setLoading(false);
    });
    return onSettingsChanged(setLocalSettings);
  }, []);

  const blockedCount = useMemo(
    () =>
      settings.auditLog.filter((e) => e.type !== 'bypass-grant' && e.type !== 'sso-fill').length,
    [settings.auditLog],
  );

  // Plugin-style tabs: a tab whose feature is disabled is removed from the DOM.
  const tabs = useMemo<{ id: TabId; label: string }[]>(() => {
    const list: { id: TabId; label: string }[] = [{ id: 'dashboard', label: 'Dashboard' }];
    if (settings.ssoEnabled) list.push({ id: 'sso', label: 'SSO' });
    list.push({ id: 'audit', label: 'Audit' });
    return list;
  }, [settings.ssoEnabled]);

  // Fall back to Dashboard when the active tab is no longer available.
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) setActiveTab('dashboard');
  }, [tabs, activeTab]);

  async function toggleAntiClickFix() {
    setLocalSettings(await setSettings({ antiClickFixEnabled: !settings.antiClickFixEnabled }));
  }

  async function toggleMask() {
    setLocalSettings(await setSettings({ maskEnabled: !settings.maskEnabled }));
  }

  async function toggleSso() {
    setLocalSettings(await setSettings({ ssoEnabled: !settings.ssoEnabled }));
  }

  async function grantBypass() {
    setLocalSettings(await setSettings({ oneTimeBypassActive: true }));
  }

  const isDryRun = settings.mode === 'DRY_RUN';

  return (
    <div className="min-h-[480px] bg-zenprax-950 text-emerald-50 font-sans">
      {/* Status header */}
      <header className="px-5 pt-5 pb-4 bg-gradient-to-br from-zenprax-900 to-zenprax-800 border-b border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
              Zenprax
            </div>
            <h1 className="text-xl font-bold leading-tight">kiba.crx</h1>
          </div>
          <div className="flex items-center gap-2">
            {isDryRun && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                DRY_RUN
              </span>
            )}
            <StatusPill active={settings.antiClickFixEnabled} />
          </div>
        </div>
        <p className="mt-2 text-xs text-emerald-200/70">
          Edge-based browser security. Blocking risks before they hit the wire.
        </p>
      </header>

      {/* Tab navigation (plugin-style: disabled features have no tab) */}
      <nav className="flex gap-1 border-b border-emerald-500/15 bg-zenprax-900/40 px-3 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === t.id
                ? 'bg-zenprax-950 text-emerald-300'
                : 'text-emerald-200/50 hover:text-emerald-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-4">
        {activeTab === 'dashboard' && (
          <Dashboard
            settings={settings}
            loading={loading}
            blockedCount={blockedCount}
            onToggleAntiClickFix={toggleAntiClickFix}
            onToggleMask={toggleMask}
            onToggleSso={toggleSso}
            onGrantBypass={grantBypass}
          />
        )}
        {activeTab === 'sso' && settings.ssoEnabled && (
          <SsoList creds={settings.ssoCredentials} />
        )}
        {activeTab === 'audit' && <AuditLog entries={settings.auditLog} />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared popup-scoped UI primitives (exported for the tab modules).
 * ------------------------------------------------------------------ */

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
      {active ? 'Protected' : 'Paused'}
    </span>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-emerald-500/15 bg-zenprax-900/60 p-3.5">
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  accent = 'emerald',
}: {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'amber';
}) {
  const color = accent === 'amber' ? 'text-amber-300' : 'text-emerald-300';
  return (
    <div className="rounded-xl border border-emerald-500/15 bg-zenprax-900/60 p-3.5">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-emerald-200/50">{label}</div>
    </div>
  );
}

export function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function TenantList({ entries }: { entries: TenantWhitelistEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
        No trusted tenants configured.
      </div>
    );
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {entries.map((e) => (
        <li
          key={`${e.provider}-${e.tenantId}`}
          className="flex items-center justify-between rounded-lg bg-zenprax-950/60 px-2.5 py-2 text-xs"
        >
          <div className="min-w-0">
            <div className="truncate text-emerald-50">{e.label}</div>
            <div className="truncate font-mono text-[10px] text-emerald-200/40">{e.tenantId}</div>
          </div>
          <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
            {e.provider}
          </span>
        </li>
      ))}
    </ul>
  );
}
