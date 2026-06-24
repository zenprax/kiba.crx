import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_SETTINGS,
  type AuditEventType,
  type AuditLogEntry,
  type KibaSettings,
} from '../types';
import { getSettings, onSettingsChanged, setSettings } from '../lib/storage';

/** Admin/User local dashboard for kiba.crx. */
export function Popup() {
  const [settings, setLocalSettings] = useState<KibaSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSettings().then((s) => {
      setLocalSettings(s);
      setLoading(false);
    });
    return onSettingsChanged(setLocalSettings);
  }, []);

  const blockedCount = useMemo(
    () => settings.auditLog.filter((e) => e.type !== 'bypass-grant').length,
    [settings.auditLog],
  );

  async function toggleAntiClickFix() {
    const next = await setSettings({ antiClickFixEnabled: !settings.antiClickFixEnabled });
    setLocalSettings(next);
  }

  async function grantBypass() {
    const next = await setSettings({ oneTimeBypassActive: true });
    setLocalSettings(next);
  }

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
          <StatusPill active={settings.antiClickFixEnabled} />
        </div>
        <p className="mt-2 text-xs text-emerald-200/70">
          Edge-based browser security. Blocking risks before they hit the wire.
        </p>
      </header>

      <main className="p-4 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Items Blocked" value={blockedCount} />
          <StatCard
            label="One-Time Bypass"
            value={settings.oneTimeBypassActive ? 'Armed' : 'Off'}
            accent={settings.oneTimeBypassActive ? 'amber' : 'emerald'}
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
              onChange={toggleAntiClickFix}
            />
          </div>
        </Card>

        {/* File control simulator */}
        <Card>
          <div className="text-sm font-semibold">File Control Simulator</div>
          <div className="mt-1 text-xs text-emerald-200/60">
            Grant a simulated one-time upload exception for testing on restricted
            domains.
          </div>
          <button
            onClick={grantBypass}
            disabled={settings.oneTimeBypassActive}
            className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zenprax-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settings.oneTimeBypassActive
              ? 'Bypass Armed — use one upload'
              : 'Grant One-Time Bypass'}
          </button>
        </Card>

        {/* Audit log */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Audit Log</div>
            <span className="text-[11px] text-emerald-200/50">
              {settings.auditLog.length} events
            </span>
          </div>
          <AuditLogList entries={settings.auditLog} />
        </Card>
      </main>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'bg-slate-500/15 text-slate-300'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-400' : 'bg-slate-400'
        }`}
      />
      {active ? 'Protected' : 'Paused'}
    </span>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-emerald-500/15 bg-zenprax-900/60 p-3.5">
      {children}
    </section>
  );
}

function StatCard({
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
      <div className="text-[11px] uppercase tracking-wide text-emerald-200/50">
        {label}
      </div>
    </div>
  );
}

function Toggle({
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

const EVENT_LABEL: Record<AuditEventType, string> = {
  'paste-block': 'PASTE',
  'file-block': 'FILE',
  'bypass-grant': 'BYPASS',
};

const EVENT_COLOR: Record<AuditEventType, string> = {
  'paste-block': 'text-rose-300 bg-rose-500/10',
  'file-block': 'text-amber-300 bg-amber-500/10',
  'bypass-grant': 'text-emerald-300 bg-emerald-500/10',
};

function AuditLogList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-emerald-500/15 py-6 text-center text-xs text-emerald-200/40">
        No security events recorded yet.
      </div>
    );
  }
  return (
    <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
      {entries.map((e, i) => (
        <li
          key={`${e.ts}-${i}`}
          className="flex items-start gap-2 rounded-lg bg-zenprax-950/60 px-2.5 py-2 text-xs"
        >
          <span
            className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${EVENT_COLOR[e.type]}`}
          >
            {EVENT_LABEL[e.type]}
          </span>
          <div className="min-w-0">
            <div className="truncate text-emerald-50">{e.detail}</div>
            <div className="text-[10px] text-emerald-200/40">
              {formatTime(e.ts)} · {e.domain || 'unknown'}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
