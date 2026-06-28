/** A labelled metric tile (e.g. blocked-count) with a brand/warn accent. */
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
