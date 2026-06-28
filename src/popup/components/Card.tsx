import type { ReactNode } from 'react';

/** Rounded surface container used to group dashboard/tab content. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-zp-xl border border-border-default bg-bg-surface/60 p-zp-3">
      {children}
    </section>
  );
}
