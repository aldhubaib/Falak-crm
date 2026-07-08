"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDown, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageHasUnsavedWork } from "@/lib/unsaved";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const startYRef = useRef<number | null>(null);
  const armedRef = useRef(false);
  // Checked once when the gesture arms — querying the whole DOM on every
  // touchmove would be wasteful.
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setEnabled(standalone);
  }, []);

  // Full-page unloads (browser-tab pull-to-refresh, reload button, tab close)
  // bypass the custom gesture entirely — the browser's own confirm dialog is
  // the only protection there. Registered regardless of standalone mode.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pageHasUnsavedWork()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
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
      if (armedRef.current) {
        dirtyRef.current = pageHasUnsavedWork();
        setDirty(dirtyRef.current);
      }
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
          if (p >= TRIGGER_PX) {
            // Unsaved form data on the page? Ask before throwing it away —
            // this gesture is easy to hit accidentally while scrolling.
            if (dirtyRef.current) setConfirmOpen(true);
            else startTransition(() => router.refresh());
          }
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

  if (!enabled) return null;

  const visible = pull > 8 || refreshing;
  const ready = pull >= TRIGGER_PX;

  const confirmRefresh = () => {
    setConfirmOpen(false);
    startTransition(() => router.refresh());
  };

  return (
    <>
      {visible && (
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
              ready && !refreshing && (dirty ? "border-amber-500/60" : "border-primary/50"),
            )}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : ready && dirty ? (
              <TriangleAlert className="h-4 w-4 text-amber-400" />
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
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Invisible click-catcher: tapping outside dismisses, same as Stay. */}
          <div className="absolute inset-0" onClick={() => setConfirmOpen(false)} />
          {/* Same floating card as the app-update popup in sw-register.tsx. */}
          <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-x-0 sm:bottom-6">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="ptr-confirm-title"
              className="flex w-full max-w-sm items-start gap-3.5 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15">
                <TriangleAlert className="h-5 w-5 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div id="ptr-confirm-title" className="text-sm font-semibold">
                  Refresh this page?
                </div>
                <div className="mt-0.5 text-sm leading-snug text-muted-foreground">
                  You have unsaved changes — refreshing will discard them.
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
                  >
                    Stay here
                  </button>
                  <button
                    type="button"
                    onClick={confirmRefresh}
                    className="flex h-9 items-center rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    Refresh & discard
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                aria-label="Dismiss"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
