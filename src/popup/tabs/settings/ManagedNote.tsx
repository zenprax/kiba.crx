import { Lock } from 'lucide-react';

/** "Read-only under organization policy" warning banner with a Lock icon. */
export function ManagedNote({ text }: { text: string }) {
  return (
    <div className="mt-zp-2 flex items-center gap-zp-2 rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm font-semibold text-brand-primary">
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
