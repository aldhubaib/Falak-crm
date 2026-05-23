import { getPipeline } from "@/actions/deals";
import { getCompanies } from "@/actions/companies";
import { getContacts } from "@/actions/contacts";
import { NewDealClient } from "./new-deal-client";

export default async function NewDealPage() {
  const [pipeline, companies, contacts] = await Promise.all([
    getPipeline(),
    getCompanies(),
    getContacts(),
  ]);

  return (
    <NewDealClient
      pipeline={pipeline ? { id: pipeline.id, stages: pipeline.stages } : null}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
    />
  );
}
