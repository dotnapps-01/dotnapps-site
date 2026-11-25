import type { ReactNode } from "react";

/** Top bar of every app screen: caps eyebrow, display H1, actions on the right. */
export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-[clamp(16px,2.4vw,32px)] py-3.5">
      <div className="min-w-0">
        {eyebrow ? <div className="k">{eyebrow}</div> : null}
        <h1 className="mb-0 mt-0.5 font-display text-2xl font-semibold tracking-display">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Padded, spaced content area under a PageHeader. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2.4vw,28px)]">{children}</div>
  );
}
