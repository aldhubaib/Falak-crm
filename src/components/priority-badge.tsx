import { cn } from "@/lib/utils";

export function PriorityBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const tone =
    value >= 8
      ? "bg-destructive/15 text-destructive"
      : value >= 5
        ? "bg-warning/15 text-warning"
        : "bg-primary/15 text-primary";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
        tone,
      )}
    >
      P{value}
    </span>
  );
}
