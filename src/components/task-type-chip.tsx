import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e",
  "#eab308", "#6366f1", "#14b8a6", "#f43f5e", "#3b82f6",
];

function colorFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const COLOR_CLASSES: Record<string, { text: string; bg: string }> = {
  "#f97316": { text: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  "#8b5cf6": { text: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  "#06b6d4": { text: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  "#ec4899": { text: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  "#22c55e": { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  "#eab308": { text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  "#6366f1": { text: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  "#14b8a6": { text: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
  "#f43f5e": { text: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  "#3b82f6": { text: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
};

export function TaskTypeChip({ name }: { name: string }) {
  const color = colorFromName(name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2 py-0.5 text-xs font-medium"
      style={{ color }}
    >
      <FileText className="h-3 w-3" />
      {name}
    </span>
  );
}

export function TaskTypeIcon({ name }: { name: string }) {
  const color = colorFromName(name);
  const classes = COLOR_CLASSES[color] ?? { text: "text-primary", bg: "bg-primary/10 border-primary/20" };
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border",
        classes.bg,
        classes.text,
      )}
      title={name}
    >
      <FileText className="h-3 w-3" strokeWidth={1.5} />
    </span>
  );
}
