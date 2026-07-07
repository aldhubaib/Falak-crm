import { getContacts } from "@/actions/contacts";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const [contacts, { member }] = await Promise.all([
    getContacts(),
    requireWorkspaceWithMember(),
  ]);

  return (
    <>
      <AppHeader title="Contacts" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ContactsClient
          contacts={contacts.map((c) => {
            const primary = c.companies.find((cc) => cc.primary) ?? c.companies[0];
            return {
              id: c.id,
              name: [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" "),
              email: c.email,
              phone: c.mobile,
              role: c.role,
              companyId: primary?.company.id ?? null,
              companyName: primary?.company.name ?? null,
              createdAt: c.createdAt.toISOString(),
            };
          })}
          editable={canEdit(member, "contacts")}
        />
      </main>
    </>
  );
}
