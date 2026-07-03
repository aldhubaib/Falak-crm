import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, message, action, className }: EmptyStateProps) {
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
