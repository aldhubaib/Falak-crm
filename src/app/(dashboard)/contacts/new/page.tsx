import { getCompanyOptions } from "@/actions/companies";
import { AppHeader } from "@/components/app-header";
import { NewContactClient } from "./new-contact-client";

export default async function NewContactPage() {
  const companies = await getCompanyOptions();

  return (
    <>
      <AppHeader title="New Contact" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <NewContactClient companies={companies} />
      </main>
    </>
  );
}
