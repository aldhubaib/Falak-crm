import { getContact } from "@/actions/contacts";
import { getCompanies } from "@/actions/companies";
import { notFound } from "next/navigation";
import { ContactDetailClient } from "./contact-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const [contact, companies] = await Promise.all([getContact(id), getCompanies()]);
  if (!contact) notFound();
  return (
    <ContactDetailClient
      contact={contact}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
