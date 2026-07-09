"use client";

// In-app notification sound: plays when a notification arrives while the app
// is open. Uses the workspace's uploaded sound when one exists, otherwise a
// soft built-in two-tone chime generated with the Web Audio API. The on/off
// preference is per device (localStorage), default ON.

import { getNotificationSoundUrl } from "@/actions/notification-sound";

const PREF_KEY = "notification-sound";
const THROTTLE_MS = 2000;
// Presigned URLs live for 1h — refresh well before that.
const URL_TTL_MS = 45 * 60 * 1000;

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PREF_KEY) !== "off";
}

export function setNotificationSoundEnabled(on: boolean): void {
  if (on) localStorage.removeItem(PREF_KEY);
  else localStorage.setItem(PREF_KEY, "off");
}

let lastPlayedAt = 0;
let cachedUrl: string | null | undefined;
let cachedAt = 0;
let fetching: Promise<string | null> | null = null;

async function customSoundUrl(): Promise<string | null> {
  const fresh = cachedUrl !== undefined && Date.now() - cachedAt < URL_TTL_MS;
  if (fresh) return cachedUrl ?? null;
  fetching ??= getNotificationSoundUrl()
    .then((url) => {
      cachedUrl = url;
      cachedAt = Date.now();
      return url;
    })
    .catch(() => cachedUrl ?? null)
    .finally(() => {
      fetching = null;
    });
  return fetching;
}

// Soft two-tone chime — no asset needed. Browsers refuse to start audio before
// the user's first interaction with the page; in that case this silently
// no-ops, which is the expected behaviour.
function playChime(): void {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const play = () => {
    const now = ctx.currentTime;
    for (const [freq, start] of [
      [880, 0],
      [1174.66, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.12, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.45);
    }
    setTimeout(() => void ctx.close().catch(() => {}), 1200);
  };
  if (ctx.state === "suspended") {
    void ctx.close().catch(() => {});
    return;
  }
  play();
}

export async function playNotificationSound(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isNotificationSoundEnabled()) return;
  const now = Date.now();
  if (now - lastPlayedAt < THROTTLE_MS) return;
  lastPlayedAt = now;

  const url = await customSoundUrl();
  if (url) {
    try {
      const audio = new Audio(url);
      audio.volume = 0.6;
      await audio.play();
      return;
    } catch {
      // Expired URL or autoplay block — refetch next time / fall through.
      cachedUrl = undefined;
    }
  }
  try {
    playChime();
  } catch {
    // Audio unavailable — nothing to do.
  }
}
