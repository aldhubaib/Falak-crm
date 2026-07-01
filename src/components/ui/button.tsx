"use client";

import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "destructive";
  size?: "sm" | "md";
  href?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", href, children, ...props }, ref) => {
    const base = cn(
      "inline-flex items-center gap-2 rounded-full border font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none",
      {
        "border-border text-foreground hover:bg-card": variant === "default",
        "border-transparent text-muted-foreground hover:text-foreground": variant === "ghost",
        "border-destructive/40 text-destructive hover:bg-destructive/10": variant === "destructive",
      },
      {
        "min-h-touch px-4 text-button": size === "sm",
        "min-h-touch-lg px-5 text-button": size === "md",
      },
      className,
    );

    if (href) {
      return (
        <Link href={href} className={cn(base, "no-underline")}>
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={base} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
