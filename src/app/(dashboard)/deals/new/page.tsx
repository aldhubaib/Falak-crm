import { getCompanies } from "@/actions/companies";
import { getContacts } from "@/actions/contacts";
import { AppHeader } from "@/components/app-header";
import { NewDealClient } from "./new-deal-client";

export default async function NewDealPage() {
  const [companies, contacts] = await Promise.all([
    getCompanies(),
    getContacts(),
  ]);

  return (
    <>
      <AppHeader title="New Deal" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <NewDealClient
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          contacts={contacts.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
          }))}
        />
      </main>
    </>
  );
}
