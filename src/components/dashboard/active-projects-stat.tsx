"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Briefcase, ListTodo } from "lucide-react";
import { PublishAvatar } from "@/components/publish/publish-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardProject } from "@/actions/projects-dashboard";

const AVATAR_SIZE = 40;
const AVATAR_OVERLAP = 10;

function hueFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function ActiveProjectsStat({
  projects,
}: {
  projects: DashboardProject[];
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [maxFit, setMaxFit] = useState(projects.length);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const compute = (w: number) => {
      const step = AVATAR_SIZE - AVATAR_OVERLAP;
      const fit = Math.max(1, Math.floor((w - AVATAR_SIZE) / step) + 1);
      setMaxFit(Math.min(projects.length, fit));
    };
    compute(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => compute(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [projects.length]);

  const total = projects.length;
  const overflowAll = total > maxFit;
  const shownCount = overflowAll
    ? Math.max(1, maxFit - 1)
    : Math.min(maxFit, total);
  const shown = projects.slice(0, shownCount);
  const overflow = total - shown.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex min-h-[7.5rem] flex-col rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-left backdrop-blur-sm transition-colors hover:border-border hover:bg-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Active Projects
          </span>
          <Briefcase className="size-3.5 text-muted-foreground" strokeWidth={2} />
        </div>
        <div ref={rowRef} className="flex flex-1 items-center justify-start gap-3">
          {total === 0 ? (
            <span className="text-xs text-muted-foreground">No active projects</span>
          ) : (
            <div className="flex items-center -space-x-2.5">
              {shown.map((p) => {
                const hue = hueFor(p.id);
                return (
                  <PublishAvatar
                    key={p.id}
                    name={p.name}
                    thumbnailId={p.thumbnailId}
                    size={40}
                    className="ring-2 ring-card"
                    fallback={
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ring-2 ring-card"
                        style={{ background: `hsl(${hue} 70% 55%)` }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                );
              })}
              {overflow > 0 && (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2 ring-card"
                  aria-hidden
                >
                  +{overflow}
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Active projects</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1 sm:grid sm:grid-cols-2">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              projects.map((p) => {
                const hue = hueFor(p.id);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={() => setOpen(false)}
                    className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-surface p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-border sm:p-4"
                    style={
                      {
                        ["--accent" as string]: `oklch(0.72 0.16 ${hue})`,
                      } as React.CSSProperties
                    }
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                      style={{ background: "var(--accent)" }}
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px opacity-40 transition-opacity group-hover:opacity-100"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, var(--accent), transparent)",
                      }}
                    />
                    <div className="relative flex items-center gap-3">
                      <PublishAvatar
                        name={p.name}
                        thumbnailId={p.thumbnailId}
                        size={40}
                        className="shadow-sm ring-1 ring-white/10"
                        fallback={
                          <div
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ring-1 ring-white/10 shadow-sm"
                            style={{ background: `hsl(${hue} 70% 55%)` }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                            {p.name}
                          </div>
                          <span
                            className="ml-auto inline-block size-1.5 shrink-0 rounded-full bg-emerald-400"
                            title="Active"
                          />
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-tiny text-muted-foreground">
                          <ListTodo className="size-3" />
                          {p.taskCount}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
