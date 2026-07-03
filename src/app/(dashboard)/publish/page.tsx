import { getPublishableProjects, getDeliveryTasks } from "@/actions/publish";
import { PublishClient } from "./publish-client";
import { toISODate, type Item } from "@/components/publish/types";

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
      project: { id: t.project.id, name: t.project.name },
      handle: `#${t.taskNumber}`,
      deliveredOn: toISODate(t.completedAt ?? t.updatedAt),
      publishOn: pi?.scheduledDate ? toISODate(new Date(pi.scheduledDate)) : undefined,
      status,
    };
  });

  return (
    <PublishClient
      items={items}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
