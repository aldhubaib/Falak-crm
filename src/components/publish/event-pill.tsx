import { cn } from "@/lib/utils";
import { type Item } from "./types";
import { PublishAvatar } from "./publish-avatar";

export function EventPill({
  item,
  className,
}: {
  item: Item;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 rounded-full", className)} title={item.title}>
      <PublishAvatar
        name={item.project.name}
        thumbnailId={item.project.thumbnailId}
        size={32}
        className="ring-2 ring-background"
      />
    </div>
  );
}
