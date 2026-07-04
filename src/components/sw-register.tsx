"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, RefreshCw, X } from "lucide-react";
import { pushSupported, syncPushSubscription } from "@/lib/push-client";

const PUSH_DISMISSED_KEY = "falak-push-dismissed-at";
const PUSH_DISMISS_DAYS = 14;

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showEnablePush, setShowEnablePush] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const handleUpdate = useCallback(() => {
    // Look up the waiting worker at click time: the captured state can go
    // stale when several updates queue up (a replaced worker turns
    // "redundant" and silently drops messages, so nothing would happen).
    const worker = registration?.waiting ?? waitingWorker;
    if (worker) {
      worker.postMessage("SKIP_WAITING");
      // controllerchange normally reloads us; if it doesn't fire (stale
      // worker, browser quirk), force the reload so the button always works.
      setTimeout(() => window.location.reload(), 1500);
    } else {
      window.location.reload();
    }
  }, [registration, waitingWorker]);

  // The permission request MUST run inside this click handler: iOS ignores
  // Notification.requestPermission() outside a user gesture (silently returns
  // "denied"), and Android demotes it to a quiet prompt nobody sees. That is
  // why the old auto-request-on-load approach never subscribed anyone.
  const handleEnablePush = useCallback(() => {
    setShowEnablePush(false);
    if (!registration) return;
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") void syncPushSubscription(registration);
      else localStorage.setItem(PUSH_DISMISSED_KEY, String(Date.now()));
    });
  }, [registration]);

  const handleDismissPush = useCallback(() => {
    setShowEnablePush(false);
    localStorage.setItem(PUSH_DISMISSED_KEY, String(Date.now()));
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker.register("/sw.js").then((r) => {
      reg = r;
      setRegistration(r);

      if (pushSupported()) {
        if (Notification.permission === "granted") {
          // Already allowed — refresh the subscription silently each session
          // so the server always has a working endpoint for this device.
          void syncPushSubscription(r);
        } else if (Notification.permission === "default") {
          const dismissedAt = Number(
            localStorage.getItem(PUSH_DISMISSED_KEY) ?? 0,
          );
          const askAgainAfter =
            dismissedAt + PUSH_DISMISS_DAYS * 24 * 60 * 60 * 1000;
          if (Date.now() > askAgainAfter) setShowEnablePush(true);
        }
      }

      if (r.waiting) {
        setWaitingWorker(r.waiting);
        setShowUpdate(true);
      }

      // Keep listening even if a worker is already waiting: a newer update
      // can replace it, and we must track the latest one or the Update
      // button would message a dead (redundant) worker.
      r.addEventListener("updatefound", () => {
        const newWorker = r.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    }).catch(() => {});

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    const interval = setInterval(() => {
      reg?.update().catch(() => {});
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  if (showUpdate) {
    return (
      <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[9999] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-x-0 sm:bottom-6">
        <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-2xl shadow-primary/20">
          <RefreshCw className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            A new version is available
          </span>
          <button
            onClick={handleUpdate}
            className="flex h-9 shrink-0 items-center rounded-xl bg-white/20 px-4 text-sm font-bold transition-colors hover:bg-white/30 active:bg-white/40"
          >
            Update
          </button>
        </div>
      </div>
    );
  }

  if (showEnablePush) {
    return (
      <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[9999] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-x-0 sm:bottom-6">
        <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-foreground shadow-2xl">
          <Bell className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            Get notified about new messages
          </span>
          <button
            onClick={handleEnablePush}
            className="flex h-9 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Enable
          </button>
          <button
            onClick={handleDismissPush}
            aria-label="Dismiss"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
