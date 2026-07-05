import { getTrashItems } from "@/actions/delete";
import { TrashClient, type TrashItem } from "./trash-client";

export default async function TrashPage() {
  const raw = await getTrashItems();
  const items: TrashItem[] = raw.map((i) => ({
    id: i.id,
    type: i.type,
    name: i.name,
    deletedAt: i.deletedAt.toISOString(),
    deletedByName: i.deletedByName,
  }));

  return <TrashClient items={items} />;
}
