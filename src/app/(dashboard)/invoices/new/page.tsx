import { getProjects } from "@/actions/projects";
import { getContacts } from "@/actions/contacts";
import { NewInvoiceClient } from "./new-invoice-client";

export default async function NewInvoicePage() {
  const [projects, contacts] = await Promise.all([
    getProjects(),
    getContacts(),
  ]);

  return (
    <NewInvoiceClient
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
    />
  );
}
