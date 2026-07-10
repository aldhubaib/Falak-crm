"use client";

import { useCallback, useRef, useState } from "react";
import {
  Download,
  Maximize2,
  Pause,
  Play,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Native <video controls> sit in the browser shadow DOM and can end up
// unclickable when ancestors use backdrop-blur, max-height sizing, or tight
// flex centering. External HTML controls always receive pointer events.
export function VideoPlayer({
  src,
  downloadHref,
  className,
  videoClassName,
}: {
  src: string;
  downloadHref?: string;
  className?: string;
  videoClassName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch {
      setFailed(true);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const seek = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(value)) return;
    video.currentTime = value;
    setCurrent(value);
  }, []);

  const enterFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) {
      void video.requestFullscreen();
      return;
    }
    const ios = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    ios.webkitEnterFullscreen?.();
  }, []);

  if (failed) {
    return (
      <div
        className={cn(
          "flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-surface/40 px-4 py-6 text-center",
          className,
        )}
      >
        <VideoOff className="h-6 w-6 text-muted-foreground" />
        <div className="text-xs text-muted-foreground">
          This video can&apos;t be played — the file may not have finished
          uploading, or your browser doesn&apos;t support its format. Try
          downloading it instead.
        </div>
        {downloadHref && (
          <a
            href={downloadHref}
            className="text-xs font-medium text-primary underline"
          >
            Download video
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative z-10 isolate w-full max-w-md pointer-events-auto",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          playsInline
          preload="metadata"
          src={src}
          className={cn(
            "block max-h-64 w-full cursor-pointer object-contain",
            videoClassName,
          )}
          onClick={togglePlay}
          onError={() => setFailed(true)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        />
        {paused && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 z-10 grid place-items-center bg-black/25 transition-colors hover:bg-black/35"
            aria-label="Play video"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/70 text-white shadow-lg">
              <Play className="h-7 w-7 fill-current" />
            </span>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/80 px-2 py-1.5">
        <button
          type="button"
          onClick={togglePlay}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted/50"
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? (
            <Play className="h-4 w-4 fill-current" />
          ) : (
            <Pause className="h-4 w-4 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted/50"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatMediaTime(current)} / {formatMediaTime(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="min-w-0 flex-1 accent-primary"
          aria-label="Seek"
        />
        <button
          type="button"
          onClick={enterFullscreen}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted/50"
          aria-label="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        {downloadHref && (
          <a
            href={downloadHref}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
