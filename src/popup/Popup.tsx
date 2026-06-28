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
    <div className="h-[600px] flex flex-col bg-bg-base text-text-primary font-sans">
      {/* Status header */}
      <header
        className={`header-wrap shrink-0 px-zp-5 pt-zp-4 border-b border-border-default relative cursor-default ${
          dangerFlash ? 'header-alert' : settings.enabled ? '' : 'header-paused'
        }`}
      >
        {/* Ambient light layer */}
        <div className="header-ambient" aria-hidden />

        {/* Top row: wordmark + controls */}
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="text-zp-sm font-bold tracking-widest text-brand-primary uppercase leading-none mb-0.5">
              Zenprax
            </div>
            <h1 className="text-zp-xl font-bold leading-tight">kiba.crx</h1>
          </div>

          <div className="flex items-center gap-zp-2 pt-0.5">
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

        {/* Hero status row: shield + label + live-feed + blocked-counter */}
        <div className="relative z-10 flex items-center gap-zp-3 pt-zp-3">
          <ShieldWrap enabled={settings.enabled} />

          <div className="flex-1 min-w-0">
            <div className={`hero-status-label text-[15px] font-bold leading-tight ${settings.enabled ? 'text-status-safe-text' : 'text-status-warn-text'}`}>
              {settings.enabled ? 'すべての脅威をブロック中' : '保護が無効になっています'}
            </div>
            {latestEntry && (
              <div className="flex items-center gap-zp-1 mt-0.5">
                <span className={`live-dot h-[5px] w-[5px] shrink-0 rounded-full ${settings.enabled ? 'bg-status-safe-text' : 'bg-status-warn-text'}`} />
                <span className="text-zp-xs text-text-secondary font-medium truncate">
                  {EVENT_TAG[latestEntry.type] ?? latestEntry.type}
                </span>
                <span className="text-zp-xs text-text-muted shrink-0">
                  {formatRelativeTime(latestEntry.ts)}
                </span>
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="relative" ref={flyupContainerRef}>
              <span className="text-[28px] font-extrabold leading-none tracking-tight text-brand-hover">
                {blockedCount}
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted mt-0.5">
              ブロック件数
            </div>
          </div>
        </div>

        {/* Feed bar */}
        {latestEntry && (
          <FeedBar entry={latestEntry} />
        )}

        {isManaged && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="relative z-10 mt-zp-2 flex cursor-default items-center gap-zp-2 rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm font-semibold text-brand-primary">
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

      {/* Hero collapse toggle — sits between header and body, centered */}
      <div className="expand-btn-wrap shrink-0">
        <button
          onClick={() => setHeroOpen((o) => !o)}
          aria-label={heroOpen ? 'コンテンツを閉じる' : 'コンテンツを開く'}
          className="expand-btn"
        >
          <span>{heroOpen ? '閉じる' : '開く'}</span>
          <span className={`expand-chevron ${heroOpen ? 'expand-chevron-open' : ''}`}>▴</span>
        </button>
      </div>

      {/* Collapsible body */}
      <div className={`hero-body flex-1 flex flex-col min-h-0 ${heroOpen ? 'hero-body-open' : 'hero-body-closed'}`}>
        {/* Tab navigation */}
        <nav className="shrink-0 flex items-stretch border-b border-border-default bg-bg-surface/80 px-zp-2 gap-0">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-keyshortcuts={`${idx + 1}`}
                data-tip={tab.label}
                className={`tab-btn px-zp-3 ${isActive ? 'tab-active' : ''}`}
              >
                {TAB_ICONS[tab.id]}
                <span className="tab-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-scroll p-zp-4">
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
        <div className="kb-hint shrink-0">
          <div className="kb-hint-item">
            <span className="kb-key">1</span>
            <span>–</span>
            <span className="kb-key">{tabs.length}</span>
            <span className="ml-0.5">タブ切替</span>
          </div>
          <div className="kb-hint-item">
            <span className="kb-key">E</span>
            <span className="ml-0.5">有効/無効</span>
          </div>
          <div className="kb-hint-item">
            <span className="kb-key">↑</span>
            <span className="kb-key">↓</span>
            <span className="ml-0.5">スクロール</span>
          </div>
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

const FEED_TAG_CLASS: Partial<Record<AuditEventType, string>> = {
  'paste-block':    'feed-tag-paste',
  'paste-mask':     'feed-tag-paste',
  'tenant-block':   'feed-tag-paste',
  'sso-fill':       'feed-tag-sso',
  'bypass-grant':   'feed-tag-bypass',
  'download-block': 'feed-tag-dl',
  'screen-share':   'feed-tag-dl',
};

function FeedBar({ entry }: { entry: { ts: number; type: AuditEventType; detail: string } }) {
  const tag = EVENT_TAG[entry.type] ?? entry.type.toUpperCase();
  const tagClass = FEED_TAG_CLASS[entry.type] ?? 'feed-tag-default';
  return (
    <div className="feed-bar-row relative z-10 mt-zp-2 flex items-center gap-zp-2 overflow-hidden border-t border-border-default/60 pt-zp-2 pb-zp-5">
      <span className={`feed-bar-tag ${tagClass}`}>
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
  onNavigateToSettings,
}: {
  entries: TenantWhitelistEntry[];
  emptyLabel?: string;
  onNavigateToSettings?: () => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default p-zp-3 text-center">
        <p className="text-zp-xs text-text-muted leading-relaxed">
          テナントを追加すると、外部貼り付けの<br />マスク精度が向上します。
        </p>
        {onNavigateToSettings && (
          <button
            onClick={onNavigateToSettings}
            className="mt-zp-1 text-zp-xs font-semibold text-brand-hover hover:underline"
          >
            + テナントを追加 →
          </button>
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
