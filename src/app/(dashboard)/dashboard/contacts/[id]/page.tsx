import { getContact } from "@/actions/contacts";
import { notFound } from "next/navigation";
import { ContactDetailClient } from "./contact-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) notFound();
  return <ContactDetailClient contact={contact} />;
}
