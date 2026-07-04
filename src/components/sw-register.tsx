"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  if (!VAPID_PUBLIC_KEY) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  try {
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const sub = subscription.toJSON();
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
      }),
    });
  } catch {}
}

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage("SKIP_WAITING");
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      reg = registration;
      subscribeToPush(registration);

      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
        return;
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
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

  if (!showUpdate) return null;

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
