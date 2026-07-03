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

export function ProjectAvatar({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full text-tiny font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: colorFromName(name) }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
