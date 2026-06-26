import { getDeals } from "@/actions/deals";
import { getChecklistTemplates } from "@/actions/settings";
import { currentUser } from "@clerk/nextjs/server";
import { NewProjectClient } from "./new-project-client";

export default async function NewProjectPage() {
  const [deals, user, templates] = await Promise.all([
    getDeals(),
    currentUser(),
    getChecklistTemplates(),
  ]);

  return (
    <NewProjectClient
      deals={deals.map((d) => ({ id: d.id, title: d.title }))}
      currentUserName={user?.fullName || user?.firstName || "Unknown"}
      checklistTemplates={templates.map((t) => ({ id: t.id, name: t.name, itemCount: t.items.length }))}
    />
  );
}
