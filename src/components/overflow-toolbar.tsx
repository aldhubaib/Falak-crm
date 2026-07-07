"use client";

// Ported from the Lovable design: a horizontal toolbar that automatically
// collapses items that don't fit into a "..." dropdown menu.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type OverflowItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
};

export function OverflowToolbar({
  items,
  renderItem,
  className,
  gap = 4,
}: {
  items: OverflowItem[];
  renderItem: (item: OverflowItem) => ReactNode;
  className?: string;
  gap?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recompute = () => {
      const available = container.clientWidth;
      const children = Array.from(measure.children) as HTMLElement[];
      const widths = children.map((c) => c.offsetWidth);
      const moreWidth = moreRef.current?.offsetWidth ?? 32;

      // Try fitting all items first.
      const totalAll =
        widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
      if (totalAll <= available) {
        setVisibleCount(items.length);
        return;
      }

      // Otherwise reserve space for the "more" button.
      let used = moreWidth + gap;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const add = widths[i] + (count > 0 ? gap : 0);
        if (used + add > available) break;
        used += add;
        count++;
      }
      setVisibleCount(count);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [items, gap]);

  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex w-full items-center", className)}
      style={{ gap }}
    >
      {/* Hidden measurement row */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex items-center"
        style={{ gap }}
      >
        {items.map((it) => (
          <div key={`m-${it.key}`}>{renderItem(it)}</div>
        ))}
      </div>

      {visible.map((it) => (
        <div key={it.key}>{renderItem(it)}</div>
      ))}

      <div
        ref={moreRef}
        className={cn("ml-auto", overflow.length === 0 && "hidden")}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map((it) => (
              <DropdownMenuItem
                key={it.key}
                onSelect={() => it.onClick?.()}
                className="gap-2"
              >
                {it.icon && (
                  <span className="text-muted-foreground">{it.icon}</span>
                )}
                <span>{it.label}</span>
                {it.trailing}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
