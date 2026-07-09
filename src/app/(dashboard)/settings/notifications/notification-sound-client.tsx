"use client";

// Settings → Notifications: upload a custom in-app notification sound.
// The sound is workspace-wide; each member can still mute it on their own
// device from the Account page.

import { useRef, useState, useTransition } from "react";
import { Loader2, Music, Play, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import {
  setNotificationSound,
  removeNotificationSound,
  type NotificationSoundDTO,
} from "@/actions/notification-sound";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function NotificationSoundClient({
  initial,
}: {
  initial: NotificationSoundDTO | null;
}) {
  const [sound, setSound] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const preview = () => {
    if (!sound) return;
    audioRef.current?.pause();
    const audio = new Audio(sound.url);
    audioRef.current = audio;
    void audio.play().catch(() => {
      setError("Could not play the file in this browser.");
    });
  };

  const pick = (file: File | null) => {
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        await setNotificationSound(fd);
        // Local preview URL until the fresh presigned one arrives on reload.
        setSound({
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          updatedAt: Date.now(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    });
  };

  const remove = () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        await removeNotificationSound();
        setSound(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove the sound");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <PageContainer className="mx-auto max-w-2xl space-y-4 pb-10">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <section className="rounded-card border border-border/60 bg-surface p-5">
        <div className="text-sm font-semibold">Notification Sound</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Played on every member&apos;s device when a notification arrives
          while the app is open. Without an upload, a built-in chime is used.
          Members can mute the sound for their own device from the Account
          page.
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted/40 text-foreground">
            <Music className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {sound ? sound.name : "Built-in chime"}
            </div>
            <div className="text-xs text-muted-foreground">
              {sound ? formatSize(sound.size) : "Default"}
            </div>
          </div>
          {sound && (
            <Button
              variant="outline"
              size="sm"
              onClick={preview}
              disabled={busy}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              Play
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {sound ? "Replace sound" : "Upload sound"}
          </Button>
          {sound && (
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={busy}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
          <span className="ml-auto text-tiny text-muted-foreground">
            MP3, WAV, OGG or M4A · max 2 MB
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </section>
    </PageContainer>
  );
}
