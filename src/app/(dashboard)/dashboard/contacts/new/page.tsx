import { getCompanies } from "@/actions/companies";
import { NewContactClient } from "./new-contact-client";

export default async function NewContactPage() {
  const companies = await getCompanies();
  return <NewContactClient companies={companies.map((c) => ({ id: c.id, name: c.name }))} />;
}
