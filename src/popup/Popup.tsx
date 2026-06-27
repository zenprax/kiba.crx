import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Lock } from 'lucide-react';
import { type TabId, type TenantWhitelistEntry } from '../types';
import { useKibaSettings, useManagedPolicy, useCredentialStatus } from './hooks';
import { Dashboard } from './tabs/Dashboard';
import { SsoList } from './tabs/SsoList';
import { AuditLog } from './tabs/AuditLog';
import { Settings } from './tabs/Settings';
import { type Translations, JA, EN, LangContext } from './i18n';

/** Admin/User local dashboard for kiba.crx. */
export function Popup() {
  const { settings, loading, updateSettings } = useKibaSettings();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const managedByPolicy = useManagedPolicy();
  const credStatus = useCredentialStatus(settings.ssoEnabled);

  const isManaged = managedByPolicy || settings.isManaged;

  const blockedCount = useMemo(
    () =>
      settings.auditLog.filter((e) => e.type !== 'bypass-grant' && e.type !== 'sso-fill').length,
    [settings.auditLog],
  );

  const t = settings.language === 'en' ? EN : JA;

  const tabs = useMemo<{ id: TabId; label: string }[]>(() => {
    const all: { id: TabId; label: string }[] = [
      { id: 'dashboard', label: t.tabs.dashboard },
      { id: 'sso',       label: t.tabs.sso },
      { id: 'audit',     label: t.tabs.audit },
      { id: 'settings',  label: t.tabs.settings },
    ];
    return all.filter((tab) => !settings.hiddenTabs.includes(tab.id));
  }, [settings.hiddenTabs, t]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab('dashboard');
  }, [tabs, activeTab]);

  async function toggleEnabled() {
    await updateSettings({ enabled: !settings.enabled });
  }

  async function toggleAntiClickFix() {
    await updateSettings({ antiClickFixEnabled: !settings.antiClickFixEnabled });
  }

  async function toggleMask() {
    await updateSettings({ maskEnabled: !settings.maskEnabled });
  }

  async function toggleSso() {
    await updateSettings({ ssoEnabled: !settings.ssoEnabled });
  }

  async function grantBypass() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const domain = new URL(tab.url).hostname;
    await chrome.runtime.sendMessage({ kind: 'kiba:request-bypass', domain });
  }

  const isDryRun = settings.mode === 'DRY_RUN';

  return (
    <LangContext.Provider value={t}>
    <Tooltip.Provider delayDuration={200}>
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
            <StatusPill active={settings.enabled} t={t} />
            <Toggle
              checked={settings.enabled}
              disabled={loading || isManaged}
              onChange={toggleEnabled}
              label="Global enable"
            />
          </div>
        </div>
        {isManaged && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="mt-3 flex cursor-default items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {t.managed}
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={6}
                className="max-w-[280px] rounded-lg border border-emerald-500/20 bg-zenprax-900 px-3 py-2 text-[11px] text-emerald-100 shadow-xl"
              >
                {t.managedTooltip}
                <Tooltip.Arrow className="fill-zenprax-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
      </header>

      {/* Tab navigation */}
      <nav className="flex gap-1 border-b border-emerald-500/15 bg-zenprax-900/40 px-3 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'bg-zenprax-950 text-emerald-300'
                : 'text-emerald-200/50 hover:text-emerald-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-4">
        {activeTab === 'dashboard' && (
          <Dashboard
            settings={settings}
            loading={loading}
            isManaged={isManaged}
            blockedCount={blockedCount}
            onToggleAntiClickFix={toggleAntiClickFix}
            onToggleMask={toggleMask}
            onToggleSso={toggleSso}
            onGrantBypass={grantBypass}
          />
        )}
        {activeTab === 'sso' && (
          <SsoList configured={credStatus.configured} count={credStatus.count} />
        )}
        {activeTab === 'audit' && <AuditLog entries={settings.auditLog} />}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            isManaged={isManaged}
            onUpdateSettings={updateSettings}
          />
        )}
      </main>
    </div>
    </Tooltip.Provider>
    </LangContext.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * Shared popup-scoped UI primitives (exported for the tab modules).
 * ------------------------------------------------------------------ */

export function StatusPill({ active, t }: { active: boolean; t: Translations }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
      {active ? t.status.protected : t.status.paused}
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
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <Switch.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-6 w-11 shrink-0 rounded-full bg-slate-600 transition data-[state=checked]:bg-emerald-500 disabled:opacity-50"
    >
      <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  );
}

export function TenantList({ entries, emptyLabel }: { entries: TenantWhitelistEntry[]; emptyLabel: string }) {
  if (entries.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
        {emptyLabel}
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
