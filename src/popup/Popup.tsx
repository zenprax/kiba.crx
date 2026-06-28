import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Lock,
  LayoutDashboard,
  Filter,
  RefreshCw,
  MapPin,
  FileText,
  Settings as SettingsIcon,
  Shield,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { type TabId, type TenantWhitelistEntry, type AuditEventType } from '../types';
import { useKibaSettings, useManagedPolicy, useCredentialStatus } from './hooks';
import { Dashboard } from './tabs/Dashboard';
import { FilterTab } from './tabs/FilterTab';
import { AntiClickFixTab } from './tabs/AntiClickFixTab';
import { SsoList } from './tabs/SsoList';
import { AuditLog } from './tabs/AuditLog';
import { Settings } from './tabs/Settings';
import { type Translations, JA, EN, LangContext } from './i18n';

const TAB_ICONS: Record<TabId, ReactNode> = {
  dashboard:     <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />,
  filter:        <Filter className="h-4 w-4 shrink-0" aria-hidden />,
  'anti-clickfix': <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />,
  sso:           <MapPin className="h-4 w-4 shrink-0" aria-hidden />,
  audit:         <FileText className="h-4 w-4 shrink-0" aria-hidden />,
  settings:      <SettingsIcon className="h-4 w-4 shrink-0" aria-hidden />,
};

const DANGER_EVENTS: AuditEventType[] = ['paste-block', 'tenant-block', 'download-block'];

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  return `${Math.floor(diff / 3600)}時間前`;
}

const EVENT_TAG: Partial<Record<AuditEventType, string>> = {
  'paste-block':    'PASTE',
  'file-block':     'FILE',
  'bypass-grant':   'BYPASS',
  'paste-mask':     'MASK',
  'sso-fill':       'SSO',
  'tenant-block':   'TENANT',
  'extension-audit': 'EXT',
  'download-block': 'DL',
  'screen-share':   'SCREEN',
};

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

  const prevBlockedRef = useRef<number>(blockedCount);
  const flyupContainerRef = useRef<HTMLDivElement>(null);
  const [dangerFlash, setDangerFlash] = useState(false);
  const [heroOpen, setHeroOpen] = useState(true);

  const latestEntry = useMemo(() => settings.auditLog[0] ?? null, [settings.auditLog]);

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

  // Phase 2-D: blocked count fly-up
  useEffect(() => {
    const prev = prevBlockedRef.current;
    const delta = blockedCount - prev;
    prevBlockedRef.current = blockedCount;
    if (delta <= 0 || !flyupContainerRef.current) return;
    const chip = document.createElement('span');
    chip.className = 'flyup-chip text-zp-sm font-bold text-status-warn-text';
    chip.textContent = `+${delta}`;
    flyupContainerRef.current.appendChild(chip);
    const timer = setTimeout(() => chip.remove(), 950);
    return () => clearTimeout(timer);
  }, [blockedCount]);

  // Phase 2-E: ambient danger flash
  useEffect(() => {
    if (!latestEntry) return;
    if (!DANGER_EVENTS.includes(latestEntry.type)) return;
    setDangerFlash(true);
    const timer = setTimeout(() => setDangerFlash(false), 1800);
    return () => clearTimeout(timer);
  }, [latestEntry]);

  // Phase 4: keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= tabs.length) {
        setActiveTab(tabs[num - 1].id);
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        void toggleEnabled();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

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

  async function toggleDownloadGater() {
    await updateSettings({ downloadGaterEnabled: !settings.downloadGaterEnabled });
  }

  async function toggleScreenShareAudit() {
    await updateSettings({ screenShareAuditEnabled: !settings.screenShareAuditEnabled });
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
      <header
        className={`px-zp-5 pt-zp-4 pb-zp-3 border-b border-border-default transition-colors duration-300 ${
          dangerFlash
            ? 'header-danger'
            : 'bg-gradient-to-br from-bg-surface to-bg-overlay'
        }`}
      >
        {/* Top row: branding + shield + controls */}
        <div className="flex items-center justify-between">
          {/* Shield wrap + brand */}
          <div className="flex items-center gap-zp-3">
            <ShieldWrap enabled={settings.enabled} />
            <div>
              <div className="text-zp-sm font-bold tracking-widest text-brand-primary uppercase">
                Zenprax
              </div>
              <h1 className="text-zp-xl font-bold leading-tight">kiba.crx</h1>
            </div>
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

        {/* Blocked count + flyup */}
        <div className="mt-zp-2 flex items-center gap-zp-2">
          <span className="text-zp-sm text-text-muted">ブロック</span>
          <div className="relative inline-block" ref={flyupContainerRef}>
            <span className="text-zp-base font-bold text-brand-primary">{blockedCount}</span>
          </div>
          <span className="text-zp-sm text-text-muted">件</span>
        </div>

        {/* Feed bar: latest audit event */}
        {latestEntry && (
          <FeedBar entry={latestEntry} />
        )}

        {isManaged && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="mt-zp-2 flex cursor-default items-center gap-zp-2 rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm font-semibold text-brand-primary">
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

        {/* Hero collapse toggle */}
        <button
          onClick={() => setHeroOpen((o) => !o)}
          aria-label={heroOpen ? 'コンテンツを閉じる' : 'コンテンツを開く'}
          className="mt-zp-2 flex w-full items-center justify-center gap-zp-1 text-zp-xs text-text-muted hover:text-text-secondary transition"
        >
          {heroOpen
            ? <><span>閉じる</span><ChevronUp className="h-3 w-3" aria-hidden /></>
            : <><span>開く</span><ChevronDown className="h-3 w-3" aria-hidden /></>
          }
        </button>
      </header>

      {/* Collapsible body */}
      <div className={`hero-body ${heroOpen ? 'hero-body-open' : 'hero-body-closed'}`}>
        {/* Tab navigation */}
        <nav className="flex gap-zp-1 border-b border-border-default bg-bg-surface/40 px-zp-2 pt-zp-2">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-keyshortcuts={`${idx + 1}`}
                title={isActive ? undefined : tab.label}
                className={`tab-btn rounded-t-zp-lg px-zp-2 py-zp-2 text-zp-md font-semibold transition ${
                  isActive
                    ? 'tab-active bg-bg-base text-brand-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {TAB_ICONS[tab.id]}
                <span className="tab-label">{tab.label}</span>
              </button>
            );
          })}
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
              onToggleDownloadGater={toggleDownloadGater}
              onToggleScreenShareAudit={toggleScreenShareAudit}
              onGrantBypass={grantBypass}
              onUpdateSettings={updateSettings}
              onNavigate={setActiveTab}
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

        {/* Keyboard hint bar */}
        <div className="border-t border-border-default bg-bg-surface/40 px-zp-3 py-zp-1 text-center text-zp-xs text-text-muted">
          1–{tabs.length} タブ切替 · E 有効/無効
        </div>
      </div>
    </div>
    </Tooltip.Provider>
    </LangContext.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * Shared popup-scoped UI primitives (exported for the tab modules).
 * ------------------------------------------------------------------ */

function ShieldWrap({ enabled }: { enabled: boolean }) {
  return (
    <div className={`relative flex items-center justify-center ${enabled ? '' : 'shield-paused'}`}>
      {/* pulse rings */}
      <span
        className={`shield-ring-1 absolute h-9 w-9 rounded-full ${
          enabled ? 'border-2 border-brand-primary' : 'border-2 border-status-warn-text'
        }`}
      />
      <span
        className={`shield-ring-2 absolute h-9 w-9 rounded-full ${
          enabled ? 'border border-brand-primary/50' : 'border border-status-warn-text/40'
        }`}
      />
      <Shield
        className={`relative h-7 w-7 ${enabled ? 'text-brand-primary' : 'text-status-warn-text'}`}
        aria-hidden
      />
    </div>
  );
}

function FeedBar({ entry }: { entry: { ts: number; type: AuditEventType; detail: string } }) {
  const tag = EVENT_TAG[entry.type] ?? entry.type.toUpperCase();
  return (
    <div className="mt-zp-2 flex items-center gap-zp-2 overflow-hidden rounded-zp-lg bg-bg-base/50 px-zp-2 py-zp-1">
      <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
      <span className="rounded bg-brand-muted px-zp-1 py-0.5 text-zp-xs font-bold uppercase text-brand-primary">
        {tag}
      </span>
      <span className="min-w-0 flex-1 truncate text-zp-xs text-text-secondary">{entry.detail}</span>
      <span className="shrink-0 text-zp-xs text-text-muted">{formatRelativeTime(entry.ts)}</span>
    </div>
  );
}

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

export function TenantList({
  entries,
  emptyLabel,
  onNavigateToSettings,
}: {
  entries: TenantWhitelistEntry[];
  emptyLabel: string;
  onNavigateToSettings?: () => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-sm text-text-muted">
        {onNavigateToSettings ? (
          <>
            <span>{emptyLabel}</span>
            {' '}
            <button
              onClick={onNavigateToSettings}
              className="inline-flex items-center gap-zp-1 text-brand-primary underline hover:no-underline"
            >
              <SettingsIcon className="h-3 w-3" aria-hidden />
              設定タブで追加
            </button>
          </>
        ) : (
          emptyLabel
        )}
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
