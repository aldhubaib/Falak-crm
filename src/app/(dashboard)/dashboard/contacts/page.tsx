import { getContacts } from "@/actions/contacts";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const contacts = await getContacts();
  return <ContactsClient contacts={contacts} />;
}
