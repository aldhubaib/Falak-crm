"use client";

// Voice-message recorder bar. Mounted (lazily, via next/dynamic) only while
// the user is recording, so the MediaRecorder/waveform code stays out of the
// initial thread bundle. Recording starts on mount; unmount stops the mic.

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Pause, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Number of bars in the live recording waveform.
const VOICE_BAR_COUNT = 40;

export default function VoiceRecorderBar({
  onFinish,
  onClose,
  onError,
}: {
  /** Called with the recorded audio file when the user taps Send. */
  onFinish: (file: File) => void;
  /** Called after the recording ends (sent or discarded). */
  onClose: () => void;
  /** Called when the mic can't start (unsupported / permission denied). */
  onError: (message: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(VOICE_BAR_COUNT).fill(0),
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);
  // Elapsed-time bookkeeping that survives pause/resume.
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  // Live waveform visualizer.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelsRef = useRef<number[]>(new Array(VOICE_BAR_COUNT).fill(0));
  const pausedRef = useRef(false);

  // Scrolls the waveform: samples the mic level each frame, shifts the bar
  // buffer left and appends the newest peak.
  const runVisualizer = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      if (!pausedRef.current) {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        // Amplify so quiet speech is visible.
        const level = Math.min(1, peak * 2.5);
        const shifted = levelsRef.current.slice(1);
        shifted.push(level);
        levelsRef.current = shifted;
        setLevels([...shifted]);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const cleanupResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // Start recording on mount; stop + release the mic on unmount.
  useEffect(() => {
    let cancelled = false;
    const onFinishRef = onFinish;
    const onCloseRef = onClose;
    const onErrorRef = onError;

    (async () => {
      if (
        typeof MediaRecorder === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        onErrorRef("Voice recording is not supported in this browser.");
        onCloseRef();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Safari (iOS) records AAC in mp4; Chrome/Firefox record Opus in webm.
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
          (t) => MediaRecorder.isTypeSupported(t),
        );
        const rec = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        chunksRef.current = [];
        discardRef.current = false;
        accumulatedRef.current = 0;
        pausedRef.current = false;
        levelsRef.current = new Array(VOICE_BAR_COUNT).fill(0);
        setLevels(levelsRef.current);
        setPaused(false);
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          cleanupResources();
          if (!discardRef.current && chunksRef.current.length > 0) {
            const type = rec.mimeType || "audio/webm";
            const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
            const stamp = new Date();
            const name = `Voice message ${stamp.toLocaleDateString()} ${stamp
              .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              .replace(/:/g, ".")}.${ext}`;
            const file = new File([new Blob(chunksRef.current, { type })], name, { type });
            onFinishRef(file);
          }
          chunksRef.current = [];
        };
        // Visualizer setup — recording continues fine without it.
        try {
          const AC =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AC();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
          runVisualizer();
        } catch {}
        recorderRef.current = rec;
        rec.start(250);
        startedAtRef.current = Date.now();
        setSecs(0);
        timerRef.current = setInterval(() => {
          const running = startedAtRef.current
            ? Date.now() - startedAtRef.current
            : 0;
          setSecs(Math.floor((accumulatedRef.current + running) / 1000));
        }, 250);
      } catch {
        onErrorRef(
          "Microphone access was denied. Allow it in your browser settings to send voice messages.",
        );
        onCloseRef();
      }
    })();

    return () => {
      cancelled = true;
      // Only a recording still RUNNING at unmount is abandoned (the user
      // navigated away mid-recording). Tapping Send already stopped the
      // recorder and nulled the ref — its onstop fires after this cleanup,
      // and flipping discardRef here would throw away the file it's about
      // to emit (voice messages would silently never send).
      if (recorderRef.current) {
        discardRef.current = true;
        try {
          recorderRef.current.stop();
        } catch {}
        recorderRef.current = null;
      }
      cleanupResources();
    };
    // Mount-only: callbacks are captured once; the recorder never restarts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = 0;
      pausedRef.current = true;
      setPaused(true);
    } else if (rec.state === "paused") {
      rec.resume();
      startedAtRef.current = Date.now();
      pausedRef.current = false;
      setPaused(false);
    }
  };

  const stop = (sendIt: boolean) => {
    discardRef.current = !sendIt;
    try {
      if (recorderRef.current?.state === "paused") recorderRef.current.resume();
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;
    onClose();
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/40 p-2 sm:gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
        aria-label="Discard recording"
        onClick={() => stop(false)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="flex shrink-0 items-center gap-1.5 text-sm">
        <span
          className={cn(
            "h-2 w-2 rounded-full bg-destructive",
            !paused && "animate-pulse",
          )}
          aria-hidden
        />
        <span className="font-medium tabular-nums">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
      </div>
      <div
        className="flex min-w-0 flex-1 items-center justify-center gap-[2px]"
        aria-hidden
      >
        {levels.map((v, i) => (
          <span
            key={i}
            className="w-[2px] rounded-full bg-muted-foreground/70"
            style={{
              height: `${Math.max(3, Math.round(v * 26))}px`,
              opacity: paused ? 0.35 : 0.5 + v * 0.5,
              transition: "height 90ms linear",
            }}
          />
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full text-destructive hover:text-destructive"
        onClick={togglePause}
        aria-label={paused ? "Resume recording" : "Pause recording"}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        className="shrink-0 rounded-full bg-success text-background hover:bg-success/90"
        onClick={() => stop(true)}
        aria-label="Send voice message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
