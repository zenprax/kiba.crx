import { Shield } from 'lucide-react';

/** Animated shield icon (pulse rings) reflecting the global enabled state. */
export function ShieldWrap({ enabled }: { enabled: boolean }) {
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
