import { redirect } from "next/navigation";
import { canEdit } from "@/lib/permissions";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { getProjectOptions } from "@/modules/script/actions";
import { AppHeader } from "@/components/app-header";
import { NewScriptClient } from "./new-script-client";

export default async function NewScriptPage() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "scripts")) redirect("/scripts");

  const projects = await getProjectOptions();

  return (
    <>
      <AppHeader title="New Script" />
      <NewScriptClient projects={projects} />
    </>
  );
}
