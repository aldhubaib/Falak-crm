import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
  /** "card" renders the dashed inline box (lists, settings); "page" renders a
   *  larger borderless layout meant to be centered in the page. */
  variant?: "card" | "page";
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
  variant = "card",
}: EmptyStateProps) {
  if (variant === "page") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 p-8 text-center",
          className,
        )}
      >
        {Icon && (
          <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-muted/50 text-muted-foreground">
            <Icon className="h-7 w-7" />
          </div>
        )}
        {title && <h3 className="text-base font-semibold">{title}</h3>}
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border/60 bg-surface/50 p-card-pad-lg text-center",
        className,
      )}
    >
      {Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
      {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
      <p className="text-hint text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
