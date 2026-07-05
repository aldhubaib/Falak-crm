import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type SaveButtonProps = Omit<ComponentProps<typeof Button>, "variant"> & {
  label?: string;
  ready?: boolean;
  /** Shows a spinner and disables the button while a save is in flight. */
  loading?: boolean;
};

export function SaveButton({
  label = "Save",
  ready,
  loading,
  className,
  children,
  disabled,
  ...props
}: SaveButtonProps) {
  return (
    <Button
      variant={ready ? "default" : "outline"}
      className={cn("rounded-md", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Save className="h-4 w-4" />
          {children ?? label}
        </>
      )}
    </Button>
  );
}
