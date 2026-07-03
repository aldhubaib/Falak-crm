import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function FormField({ label, htmlFor, hint, error, children, className, action }: FormFieldProps) {
  return (
    <div className={cn("space-y-field-gap", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-label text-muted-foreground">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {hint && !error && <p className="text-hint text-muted-foreground">{hint}</p>}
      {error && <p className="text-hint text-destructive">{error}</p>}
    </div>
  );
}
