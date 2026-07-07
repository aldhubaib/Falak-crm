import { getCompanyOptions } from "@/actions/companies";
import { NewContactClient } from "./new-contact-client";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const [{ companyId }, companies] = await Promise.all([
    searchParams,
    getCompanyOptions(),
  ]);

  return <NewContactClient companies={companies} initialCompanyId={companyId} />;
}
