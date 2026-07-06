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
  const isPublished = item.status === "published";
  return (
    <div className={cn("shrink-0 rounded-full", className)} title={item.title}>
      <PublishAvatar
        name={item.project.name}
        thumbnailId={item.project.thumbnailId}
        size={32}
        // Completed (published) tasks get a green ring, matching the green
        // border on completed cards elsewhere on the publish page.
        className={cn("ring-2", isPublished ? "ring-success" : "ring-background")}
      />
    </div>
  );
}
