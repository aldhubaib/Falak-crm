import { ProjectAvatar } from "@/components/project-avatar";
import { cn } from "@/lib/utils";
import { type Item } from "./types";

export function EventPill({
  item,
  className,
}: {
  item: Item;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 rounded-full", className)} title={item.title}>
      <ProjectAvatar
        name={item.project.name}
        size={32}
        className="ring-2 ring-background"
      />
    </div>
  );
}
