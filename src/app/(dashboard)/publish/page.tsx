import { getPublishableProjects, getDeliveryTasks } from "@/actions/publish";
import { PublishClient } from "./publish-client";
import {
  attachmentIsImage,
  toISODate,
  type Item,
} from "@/components/publish/types";

export default async function PublishPage() {
  const [projects, tasks] = await Promise.all([
    getPublishableProjects(),
    getDeliveryTasks(null),
  ]);

  const items: Item[] = tasks.map((t) => {
    const pi = t.publishItem;
    const status: Item["status"] = pi
      ? pi.published
        ? "published"
        : "scheduled"
      : "queued";
    return {
      id: t.id,
      taskId: t.id,
      publishItemId: pi?.id,
      title: t.title,
      projectId: t.projectId,
      project: {
        id: t.project.id,
        name: t.project.name,
        thumbnailId: t.project.thumbnailId ?? null,
      },
      handle: `#${t.taskNumber}`,
      deliveredOn: toISODate(t.completedAt ?? t.updatedAt),
      publishOn: pi?.scheduledDate ? toISODate(new Date(pi.scheduledDate)) : undefined,
      status,
      // The card layout is dynamic: each field's "Publish card" placement in
      // Settings → Task Types decides if it renders and whether it's visible
      // while the card is collapsed ("always") or only when opened.
      attachments: t.checklistItems
        .filter((c) => c.publishCard !== "hidden" && c.attachmentId)
        .map((c) => ({
          attachmentId: c.attachmentId as string,
          label: c.name,
          isImage: attachmentIsImage(c.allowedFormats),
          always: c.publishCard === "always",
        })),
      // Filled-in text fields (mention, caption, …) shown with a copy button.
      texts: t.checklistItems
        .filter((c) => c.publishCard !== "hidden" && c.textValue?.trim())
        .map((c) => ({
          label: c.name,
          value: c.textValue!.trim(),
          always: c.publishCard === "always",
        })),
    };
  });

  return (
    <PublishClient
      items={items}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        thumbnailId: p.thumbnailId ?? null,
      }))}
    />
  );
}
