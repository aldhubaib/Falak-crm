import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SurfaceCard } from "@/components/surface-card";

export interface SettingsSectionProps {
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: SettingsSectionProps) {
  return (
    <SurfaceCard padding="lg" className={cn("space-y-section-gap", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-foreground">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
            {description && (
              <p className="mt-0.5 text-hint text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("space-y-field-gap", bodyClassName)}>{children}</div>
    </SurfaceCard>
  );
}
