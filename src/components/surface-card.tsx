import { forwardRef, type ElementType, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Padding = "none" | "sm" | "lg";

const paddingClass: Record<Padding, string> = {
  none: "",
  sm: "p-card-pad",
  lg: "p-card-pad-lg",
};

export interface SurfaceCardProps extends HTMLAttributes<HTMLElement> {
  padding?: Padding;
  as?: ElementType;
}

export const SurfaceCard = forwardRef<HTMLElement, SurfaceCardProps>(
  ({ padding = "sm", as: Tag = "div", className, ...rest }, ref) => {
    const Component = Tag as ElementType;
    return (
      <Component
        ref={ref}
        className={cn(
          "rounded-card border border-border/60 bg-surface",
          paddingClass[padding],
          className,
        )}
        {...rest}
      />
    );
  },
);
SurfaceCard.displayName = "SurfaceCard";
