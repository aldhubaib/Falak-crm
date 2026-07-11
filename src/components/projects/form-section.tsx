import type { ReactNode } from "react";

/** Card-style section used on the New Task and Task Detail pages. */
export function FormSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {hint && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}
