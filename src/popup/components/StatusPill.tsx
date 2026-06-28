import type { Translations } from '../i18n';

/** Compact protected/paused status badge shown in the header. */
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
