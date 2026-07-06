import { getPublishableProjects, getDeliveryTasks } from "@/actions/publish";
import { fieldConfig } from "@/lib/checklist-config";
import { PublishClient } from "./publish-client";
import {
  attachmentIsImage,
  publishTextValue,
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
    // Card fields resolve against the LIVE template config (name, placement,
    // formats, hidden, order) so settings changes apply to existing tasks.
    const fields = t.checklistItems
      .map((c) => ({ row: c, cfg: fieldConfig(c) }))
      .filter((f) => !f.cfg.hidden && f.cfg.publishCard !== "hidden")
      .sort((a, b) => a.cfg.order - b.cfg.order);
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
      attachments: fields
        .filter((f) => f.row.attachmentId)
        .map((f) => ({
          attachmentId: f.row.attachmentId as string,
          label: f.cfg.name,
          isImage: attachmentIsImage(f.cfg.allowedFormats),
          always: f.cfg.publishCard === "always",
        })),
      // Filled-in text fields (mention, caption, …) shown with a copy button.
      // Yes/No fields (mention, copyright) only appear when answered Yes with
      // a follow-up value — a bare "No" has nothing to publish.
      texts: fields
        .map((f) => ({
          label: f.cfg.name,
          value: publishTextValue(f.cfg.type, f.row.textValue),
          always: f.cfg.publishCard === "always",
        }))
        .filter((c): c is Item["texts"][number] => !!c.value),
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
