import Link from "next/link";
import { Plus } from "lucide-react";
import { canEdit } from "@/lib/permissions";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { getScripts } from "@/modules/script/actions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { ScriptsClient } from "./scripts-client";

export default async function ScriptsPage() {
  const [scripts, { member }] = await Promise.all([
    getScripts(),
    requireWorkspaceWithMember(),
  ]);
  const editable = canEdit(member, "scripts");

  return (
    <>
      <AppHeader
        title="Scripts"
        actions={
          editable ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/scripts/new">
                <Plus className="h-4 w-4" />
                New Script
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ScriptsClient scripts={scripts} editable={editable} />
    </>
  );
}
