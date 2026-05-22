import { getPipeline } from "@/actions/deals";
import { getCompanies } from "@/actions/companies";
import { getContacts } from "@/actions/contacts";
import { getServices } from "@/actions/services";
import { DealsClient } from "./deals-client";

export default async function DealsPage() {
  const [pipeline, companies, contacts, services] = await Promise.all([
    getPipeline(),
    getCompanies(),
    getContacts(),
    getServices(),
  ]);

  return (
    <DealsClient
      pipeline={pipeline}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
      services={services.map((s) => ({ id: s.id, name: s.name, unitPrice: Number(s.unitPrice) }))}
    />
  );
}
