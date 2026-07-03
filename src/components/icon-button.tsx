import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  "aria-label": string;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "sm", variant = "ghost", ...rest }, ref) => (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      className={cn(
        size === "sm" ? "h-control-h-sm w-control-h-sm" : "h-control-h w-control-h",
        "shrink-0",
        className,
      )}
      {...rest}
    />
  ),
);
IconButton.displayName = "IconButton";
