import { notFound } from "next/navigation";
import { canEdit } from "@/lib/permissions";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { getScript } from "@/modules/script/actions";
import { AppHeader } from "@/components/app-header";
import { ScriptClient } from "./script-client";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ scriptId: string }>;
}) {
  const { scriptId } = await params;
  const [script, { member }] = await Promise.all([
    getScript(scriptId),
    requireWorkspaceWithMember(),
  ]);
  if (!script) notFound();

  return (
    <>
      <AppHeader title={script.title} backHref="/scripts" />
      <ScriptClient script={script} editable={canEdit(member, "scripts")} />
    </>
  );
}
