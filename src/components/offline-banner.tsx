"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, X } from "lucide-react";

// navigator.onLine is unreliable: VPNs, virtual adapters, Wi-Fi roaming and
// sleep/wake all report "offline" while the connection is actually fine. The
// browser events are therefore only treated as a hint — the banner shows only
// after the server genuinely can't be reached, and keeps re-probing while
// down so it clears itself even if the "online" event never fires.
const PROBE_TIMEOUT_MS = 4000;
const RETRY_INTERVAL_MS = 5000;

/** Any HTTP response proves connectivity; only a network error counts as
 * offline. /api/ping is never intercepted by the service worker, so a cached
 * response can't fake being online. */
async function serverReachable(): Promise<boolean> {
  try {
    await fetch(`/api/ping?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal:
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(PROBE_TIMEOUT_MS)
          : undefined,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Connectivity popup: shows a persistent card while the server is actually
 * unreachable and a short "Back online" confirmation when the connection
 * returns.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  const backOnlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumping the generation invalidates in-flight probes and scheduled retries.
  const probeGen = useRef(0);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const markOnline = () => {
      clearRetry();
      setOffline((was) => {
        if (was) {
          setBackOnline(true);
          if (backOnlineTimer.current) clearTimeout(backOnlineTimer.current);
          backOnlineTimer.current = setTimeout(() => setBackOnline(false), 3000);
        }
        return false;
      });
    };

    const verify = async () => {
      const gen = ++probeGen.current;
      const reachable = await serverReachable();
      if (gen !== probeGen.current) return; // superseded by a newer check
      if (reachable) {
        markOnline();
      } else {
        setBackOnline(false);
        setOffline(true);
        clearRetry();
        retryTimer = setTimeout(() => void verify(), RETRY_INTERVAL_MS);
      }
    };

    const onOffline = () => {
      setDismissed(false);
      void verify();
    };
    const onOnline = () => {
      probeGen.current++; // cancel pending retries — the browser says we're back
      markOnline();
    };

    if (!navigator.onLine) void verify();

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      probeGen.current++;
      clearRetry();
      if (backOnlineTimer.current) clearTimeout(backOnlineTimer.current);
    };
  }, []);

  if (offline && !dismissed) {
    return (
      <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[9999] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-x-0 sm:bottom-6">
        <div className="flex w-full max-w-sm items-start gap-3.5 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10">
            <WifiOff className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">No internet connection</div>
            <div className="mt-0.5 text-sm leading-snug text-muted-foreground">
              You&apos;re offline. Changes won&apos;t be saved until the
              connection is back.
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (backOnline) {
    return (
      <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[9999] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-x-0 sm:bottom-6">
        <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-foreground shadow-2xl">
          <Wifi className="h-5 w-5 shrink-0 text-emerald-500" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            Back online
          </span>
        </div>
      </div>
    );
  }

  return null;
}
