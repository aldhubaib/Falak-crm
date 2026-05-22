import { getContacts } from "@/actions/contacts";
import { getCompanies } from "@/actions/companies";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const [contacts, companies] = await Promise.all([
    getContacts(),
    getCompanies(),
  ]);
  return (
    <ContactsClient
      contacts={contacts}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
