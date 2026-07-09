"use client";

// In-app notification sound: plays when a notification arrives while the app
// is open. The workspace's uploaded sound is downloaded ONCE and stored in
// Cache Storage (survives restarts, works offline, instant playback); a
// version check on app load keeps it current, and a realtime broadcast forces
// a refresh the moment an admin replaces the file. Without an upload a soft
// built-in chime is generated with the Web Audio API.
//
// The on/off preference is per device (localStorage), default ON.

import { getNotificationSoundUrl } from "@/actions/notification-sound";

const PREF_KEY = "notification-sound";
const THROTTLE_MS = 2000;
const CACHE_NAME = "falak-notification-sound";
const cacheKeyFor = (version: number) => `/__notification-sound__/${version}`;

// ─── Preference ───────────────────────────────────────────────────────────────

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PREF_KEY) !== "off";
}

export function setNotificationSoundEnabled(on: boolean): void {
  if (on) localStorage.removeItem(PREF_KEY);
  else localStorage.setItem(PREF_KEY, "off");
}

// ─── Local copy of the workspace sound ────────────────────────────────────────

// null = not synced yet this session; "none" = synced, no custom sound.
type SoundState = { version: number; objectUrl: string } | "none" | null;
let sound: SoundState = null;
let syncing: Promise<void> | null = null;
// Bumped on invalidation so a stale in-flight sync can't win a race against
// the fresh one.
let generation = 0;

async function readFromCache(version: number): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(cacheKeyFor(version));
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

// Offline fallback: whatever version is cached is better than silence.
async function readAnyFromCache(): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const last = keys[keys.length - 1];
    if (!last) return null;
    const res = await cache.match(last);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

async function writeToCache(version: number, blob: Blob): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const key of await cache.keys()) await cache.delete(key);
    await cache.put(cacheKeyFor(version), new Response(blob));
  } catch {
    // Storage full / private mode — playback falls back to in-memory only.
  }
}

async function clearCache(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {}
}

function dropObjectUrl(): void {
  if (sound && sound !== "none") URL.revokeObjectURL(sound.objectUrl);
}

async function doSync(): Promise<void> {
  const gen = generation;
  let meta: Awaited<ReturnType<typeof getNotificationSoundUrl>> | undefined;
  try {
    meta = await getNotificationSoundUrl();
  } catch {
    return; // Network/server hiccup — keep playing what we have.
  }
  if (gen !== generation) return;

  if (!meta) {
    dropObjectUrl();
    sound = "none";
    await clearCache();
    return;
  }
  if (sound && sound !== "none" && sound.version === meta.version) return;

  let blob = await readFromCache(meta.version);
  if (!blob) {
    try {
      const res = await fetch(meta.url);
      if (!res.ok) return;
      blob = await res.blob();
    } catch {
      return;
    }
    if (gen !== generation) return;
    await writeToCache(meta.version, blob);
  }
  if (gen !== generation) return;
  dropObjectUrl();
  sound = { version: meta.version, objectUrl: URL.createObjectURL(blob) };
}

/** Check the server's sound version and (re)download the file if it changed.
 *  Call on app load — after that, playback is fully local. */
export function ensureNotificationSoundCached(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  syncing ??= doSync().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** The admin replaced the workspace sound (realtime broadcast): drop the local
 *  copy and download the new one right away. */
export function invalidateNotificationSoundCache(): void {
  generation += 1;
  dropObjectUrl();
  sound = null;
  syncing = null;
  void ensureNotificationSoundCached();
}

// ─── Playback ─────────────────────────────────────────────────────────────────

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
  if (ctx.state === "suspended") {
    void ctx.close().catch(() => {});
    return;
  }
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
}

async function resolveSource(): Promise<string | null> {
  if (sound === "none") return null;
  if (sound) return sound.objectUrl;
  // Not synced yet — kick the sync off and meanwhile use any cached copy so
  // the very first notification of a session still plays without a download.
  void ensureNotificationSoundCached();
  const blob = await readAnyFromCache();
  return blob ? URL.createObjectURL(blob) : null;
}

async function playCurrent(): Promise<void> {
  const src = await resolveSource();
  if (src) {
    try {
      const audio = new Audio(src);
      audio.volume = 0.6;
      await audio.play();
      return;
    } catch {
      // Autoplay block or broken blob — fall through to the chime.
    }
  }
  try {
    playChime();
  } catch {
    // Audio unavailable — nothing to do.
  }
}

let lastPlayedAt = 0;

/** Notification arrived: respects the per-device mute and a 2s throttle. */
export async function playNotificationSound(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isNotificationSoundEnabled()) return;
  const now = Date.now();
  if (now - lastPlayedAt < THROTTLE_MS) return;
  lastPlayedAt = now;
  await playCurrent();
}

/** Explicit user action (toggle, "hear new sound" button): no mute check, no
 *  throttle. */
export async function previewNotificationSound(): Promise<void> {
  if (typeof window === "undefined") return;
  await playCurrent();
}
