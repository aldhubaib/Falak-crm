import { FileText } from "lucide-react";

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
