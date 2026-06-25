import type { SsoCredential } from '../../types';
import { Card } from '../Popup';

/** Pseudo-SSO credential list tab (passwords always masked). */
export function SsoList({ creds }: { creds: SsoCredential[] }) {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Shared Credentials</div>
          <span className="text-[11px] text-emerald-200/50">{creds.length} entries</span>
        </div>
        <p className="mt-1 text-xs text-emerald-200/60">
          Mock shared-account credentials used by the pseudo-SSO autofill demo.
        </p>
        {creds.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
            No shared credentials configured.
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {creds.map((c) => (
              <li
                key={c.urlMatch}
                className="flex items-center justify-between rounded-lg bg-zenprax-950/60 px-2.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate text-emerald-50">{c.username}</div>
                  <div className="truncate text-[10px] text-emerald-200/40">{c.urlMatch}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-emerald-200/40">••••••</span>
                  {c.autoSubmit && (
                    <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                      AUTO
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
