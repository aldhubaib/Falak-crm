import { getTrashItems } from "@/actions/delete";
import { TrashClient } from "./trash-client";

export default async function TrashPage() {
  const items = await getTrashItems();
  return <TrashClient items={items} />;
}
