import type { TenantWhitelistEntry } from '../../types';

/** Trusted-tenant list with an empty-state CTA into Settings. */
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
          テナントを追加すると、外部貼り付けの
          <br />
          マスク精度が向上します。
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
