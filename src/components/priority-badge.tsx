import { cn } from "@/lib/utils";

function getPriorityStyle(priority: number) {
  if (priority >= 9)
    return { color: "text-destructive", bg: "bg-destructive/15 border-destructive/20" };
  if (priority >= 7)
    return { color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/20" };
  if (priority >= 4)
    return { color: "text-primary", bg: "bg-primary/15 border-primary/20" };
  return { color: "text-muted-foreground", bg: "bg-muted border-border" };
}

export function PriorityBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const style = getPriorityStyle(value);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        style.bg,
        style.color,
      )}
    >
      P{value}
    </span>
  );
}
