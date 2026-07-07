"use client";

// Related Data for a deal: its linked company and contact, rendered with the
// shared RelatedSection/LinkPickerDialog components.

import { useState } from "react";
import { Building2, Users } from "lucide-react";
import {
  LinkPickerDialog,
  RelatedEmail,
  RelatedPhone,
  RelatedSection,
  type LinkPickerOption,
} from "@/components/crm/related-data";
import { setDealCompany, setDealContact } from "@/actions/deals";

type PartyRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export function DealRelated({
  dealId,
  company,
  contact,
  companyOptions,
  contactOptions,
}: {
  dealId: string;
  company: PartyRow | null;
  contact: PartyRow | null;
  companyOptions: LinkPickerOption[];
  contactOptions: LinkPickerOption[];
}) {
  const [companyPicker, setCompanyPicker] = useState(false);
  const [contactPicker, setContactPicker] = useState(false);

  const partyColumns = [
    { key: "name", header: "Name", render: (r: PartyRow) => r.name },
    { key: "email", header: "Email", render: (r: PartyRow) => <RelatedEmail value={r.email} /> },
    { key: "phone", header: "Phone", render: (r: PartyRow) => <RelatedPhone value={r.phone} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Related Data
      </div>

      <RelatedSection
        label="COMPANY"
        icon={<Building2 className="h-3 w-3" />}
        rows={company ? [company] : []}
        getRowId={(c) => c.id}
        getRowHref={(c) => `/companies/${c.id}`}
        emptyMessage="No company linked yet."
        onAdd={() => setCompanyPicker(true)}
        columns={partyColumns}
        remove={{
          title: "Remove company link?",
          description: (c) =>
            `“${c.name}” will be unlinked. The company itself won’t be deleted.`,
          action: () => setDealCompany(dealId, null),
        }}
      />

      <RelatedSection
        label="CONTACT"
        icon={<Users className="h-3 w-3" />}
        rows={contact ? [contact] : []}
        getRowId={(c) => c.id}
        getRowHref={(c) => `/contacts/${c.id}`}
        emptyMessage="No contact linked yet."
        onAdd={() => setContactPicker(true)}
        columns={partyColumns}
        remove={{
          title: "Remove contact link?",
          description: (c) =>
            `“${c.name}” will be unlinked. The contact itself won’t be deleted.`,
          action: () => setDealContact(dealId, null),
        }}
      />

      <LinkPickerDialog
        open={companyPicker}
        onOpenChange={setCompanyPicker}
        title="Companies"
        placeholder="Search companies…"
        icon={<Building2 className="h-3.5 w-3.5" />}
        options={companyOptions}
        linkedIds={company ? [company.id] : []}
        onLink={(id) => setDealCompany(dealId, id)}
        onUnlink={() => setDealCompany(dealId, null)}
        newHref="/companies/new"
      />

      <LinkPickerDialog
        open={contactPicker}
        onOpenChange={setContactPicker}
        title="Contacts"
        placeholder="Search contacts…"
        icon={<Users className="h-3.5 w-3.5" />}
        options={contactOptions}
        linkedIds={contact ? [contact.id] : []}
        onLink={(id) => setDealContact(dealId, id)}
        onUnlink={() => setDealContact(dealId, null)}
        newHref="/contacts/new"
      />
    </div>
  );
}
