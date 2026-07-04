import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { AppHeader } from "@/components/app-header";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  const { member } = await requireWorkspaceWithMember();
  const profile = await db.workspaceMember.findUnique({
    where: { id: member.id },
    select: { name: true, email: true, imageUrl: true },
  });
  if (!profile) notFound();

  return (
    <>
      <AppHeader title="Account" backHref="/dashboard" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <AccountClient
          name={profile.name ?? ""}
          email={profile.email}
          imageUrl={profile.imageUrl ?? null}
        />
      </main>
    </>
  );
}
