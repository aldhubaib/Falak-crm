import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type SaveButtonProps = Omit<ComponentProps<typeof Button>, "variant"> & {
  label?: string;
  ready?: boolean;
};

export function SaveButton({ label = "Save", ready, className, children, ...props }: SaveButtonProps) {
  return (
    <Button
      variant={ready ? "default" : "outline"}
      className={cn("rounded-md", className)}
      {...props}
    >
      <Save className="h-4 w-4" />
      {children ?? label}
    </Button>
  );
}
