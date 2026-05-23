import { currentUser } from "@clerk/nextjs/server";
import { getPipeline } from "@/actions/deals";
import { getCompanies } from "@/actions/companies";
import { getContacts } from "@/actions/contacts";
import { getWorkspaceCurrency } from "@/actions/currencies";
import { NewDealClient } from "./new-deal-client";

export default async function NewDealPage() {
  const [pipeline, companies, contacts, workspace, user] = await Promise.all([
    getPipeline(),
    getCompanies(),
    getContacts(),
    getWorkspaceCurrency(),
    currentUser(),
  ]);

  return (
    <NewDealClient
      pipeline={pipeline ? { id: pipeline.id, stages: pipeline.stages } : null}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
      currency={workspace.baseCurrency}
      currentUserName={user?.fullName || user?.firstName || "Unknown"}
    />
  );
}
