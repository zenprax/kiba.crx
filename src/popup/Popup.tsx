import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Lock } from 'lucide-react';
import { type TabId, type TenantWhitelistEntry } from '../types';
import { useKibaSettings, useManagedPolicy, useCredentialStatus } from './hooks';
import { Dashboard } from './tabs/Dashboard';
import { FilterTab } from './tabs/FilterTab';
import { AntiClickFixTab } from './tabs/AntiClickFixTab';
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
      { id: 'dashboard',     label: t.tabs.dashboard },
      { id: 'filter',        label: t.tabs.filter },
      { id: 'anti-clickfix', label: t.tabs.antiClickFix },
      { id: 'sso',           label: t.tabs.sso },
      { id: 'audit',         label: t.tabs.audit },
      { id: 'settings',      label: t.tabs.settings },
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

  async function toggleNetworkFilter() {
    await updateSettings({ networkFilterEnabled: !settings.networkFilterEnabled });
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
    <div className="min-h-[480px] bg-bg-base text-text-primary font-sans">
      {/* Status header */}
      <header className="px-zp-5 pt-zp-5 pb-zp-4 bg-gradient-to-br from-bg-surface to-bg-overlay border-b border-border-default">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-zp-sm font-bold tracking-widest text-brand-primary uppercase">
              Zenprax
            </div>
            <h1 className="text-zp-xl font-bold leading-tight">kiba.crx</h1>
          </div>
          <div className="flex items-center gap-zp-2">
            {isDryRun && (
              <span className="inline-flex items-center gap-zp-1 rounded-zp-full bg-status-warn-bg px-zp-2 py-zp-1 text-zp-sm font-semibold text-status-warn-text">
                <span className="h-1.5 w-1.5 rounded-zp-full bg-status-warn-text" />
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
              <div className="mt-zp-3 flex cursor-default items-center gap-zp-2 rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm font-semibold text-brand-primary">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {t.managed}
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={6}
                className="max-w-[280px] rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm text-text-primary shadow-shadow-lg"
              >
                {t.managedTooltip}
                <Tooltip.Arrow className="fill-bg-surface" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
      </header>

      {/* Tab navigation */}
      <nav className="flex gap-zp-1 border-b border-border-default bg-bg-surface/40 px-zp-3 pt-zp-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-zp-lg px-zp-3 py-zp-2 text-zp-md font-semibold transition ${
              activeTab === tab.id
                ? 'bg-bg-base text-brand-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-zp-4">
        {activeTab === 'dashboard' && (
          <Dashboard
            settings={settings}
            loading={loading}
            isManaged={isManaged}
            blockedCount={blockedCount}
            onToggleAntiClickFix={toggleAntiClickFix}
            onToggleMask={toggleMask}
            onToggleSso={toggleSso}
            onToggleNetworkFilter={toggleNetworkFilter}
            onGrantBypass={grantBypass}
          />
        )}
        {activeTab === 'filter' && (
          <FilterTab
            settings={settings}
            isManaged={isManaged}
            onUpdateSettings={updateSettings}
          />
        )}
        {activeTab === 'anti-clickfix' && <AntiClickFixTab settings={settings} />}
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
      className={`inline-flex items-center gap-zp-1 rounded-zp-full px-zp-2 py-zp-1 text-zp-sm font-semibold ${
        active ? 'bg-status-safe-bg text-status-safe-text' : 'bg-bg-overlay text-text-muted'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-zp-full ${active ? 'bg-status-safe-text' : 'bg-text-muted'}`}
      />
      {active ? t.status.protected : t.status.paused}
    </span>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-zp-xl border border-border-default bg-bg-surface/60 p-zp-3">
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  accent = 'brand',
}: {
  label: string;
  value: string | number;
  accent?: 'brand' | 'warn';
}) {
  const color = accent === 'warn' ? 'text-status-warn-text' : 'text-brand-primary';
  return (
    <div className="rounded-zp-xl border border-border-default bg-bg-surface/60 p-zp-3">
      <div className={`text-zp-2xl font-bold ${color}`}>{value}</div>
      <div className="text-zp-sm uppercase tracking-wide text-text-muted">{label}</div>
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
      className="relative h-6 w-11 shrink-0 rounded-zp-full bg-toggle-off transition data-[state=checked]:bg-brand-primary disabled:opacity-50"
    >
      <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-zp-full bg-toggle-knob transition-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  );
}

export function TenantList({ entries, emptyLabel }: { entries: TenantWhitelistEntry[]; emptyLabel: string }) {
  if (entries.length === 0) {
    return (
      <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-sm text-text-muted">
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul className="mt-zp-2 space-y-1.5">
      {entries.map((e) => (
        <li
          key={`${e.provider}-${e.tenantId}`}
          className="flex items-center justify-between rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-2 text-zp-md"
        >
          <div className="min-w-0">
            <div className="truncate text-text-primary">{e.label}</div>
            <div className="truncate font-mono text-zp-xs text-text-muted">{e.tenantId}</div>
          </div>
          <span className="shrink-0 rounded-zp-sm bg-brand-muted px-zp-1 py-0.5 text-zp-xs font-bold uppercase text-brand-primary">
            {e.provider}
          </span>
        </li>
      ))}
    </ul>
  );
}
