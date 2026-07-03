import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const PageContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "p-page-x md:p-page-x-md space-y-section-gap",
        className,
      )}
      {...rest}
    />
  ),
);
PageContainer.displayName = "PageContainer";
