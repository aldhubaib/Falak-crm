import { getCompanyOptions } from "@/actions/companies";
import { getContactOptions } from "@/actions/contacts";
import { AppHeader } from "@/components/app-header";
import { NewDealClient } from "./new-deal-client";

export default async function NewDealPage() {
  const [companies, contacts] = await Promise.all([
    getCompanyOptions(),
    getContactOptions(),
  ]);

  return (
    <>
      <AppHeader title="New Deal" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <NewDealClient
          companies={companies}
          contacts={contacts.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
          }))}
        />
      </main>
    </>
  );
}
