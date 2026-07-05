"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Distance (px) the finger must travel before releasing triggers a refresh.
const TRIGGER_PX = 70;
// Cap so the indicator stops following the finger at some point.
const MAX_PULL_PX = 110;

// Pull-to-refresh for the installed PWA. Browsers provide this natively, but
// standalone mode (iOS/Android home-screen installs) has no way to reload a
// stale page. Active only in standalone so it never fights the browser's own
// gesture. Works on any scrollable page: the gesture only arms when every
// scrollable ancestor under the finger is already at the top.
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(false);
  const startYRef = useRef<number | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setEnabled(standalone);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const atTop = (target: EventTarget | null) => {
      let el = target instanceof Element ? target : null;
      while (el) {
        if (el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      armedRef.current = atTop(e.target);
      startYRef.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!armedRef.current || startYRef.current == null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band feel: the indicator falls behind the finger.
      setPull(Math.min(dy * 0.5, MAX_PULL_PX));
    };

    const onEnd = () => {
      if (armedRef.current && startYRef.current != null) {
        setPull((p) => {
          if (p >= TRIGGER_PX) startTransition(() => router.refresh());
          return 0;
        });
      }
      armedRef.current = false;
      startYRef.current = null;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, router]);

  const visible = pull > 8 || refreshing;
  if (!enabled || !visible) return null;

  const ready = pull >= TRIGGER_PX;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(${refreshing ? 16 : Math.max(pull - 40, -40)}px)`,
        transition: pull === 0 ? "transform 200ms ease" : undefined,
      }}
    >
      <div
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-surface shadow-lg",
          ready && !refreshing && "border-primary/50",
        )}
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={cn(
              "h-4 w-4 transition-transform",
              ready ? "rotate-180 text-primary" : "text-muted-foreground",
            )}
          />
        )}
      </div>
    </div>
  );
}
