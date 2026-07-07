"use client";

// Related Data for a company: linked contacts and deals, rendered with the
// shared RelatedSection/LinkPickerDialog components.

import { useState } from "react";
import { Handshake, Users } from "lucide-react";
import {
  LinkPickerDialog,
  RelatedEmail,
  RelatedMuted,
  RelatedPhone,
  RelatedSection,
  type LinkPickerOption,
} from "@/components/crm/related-data";
import { addContactCompany, removeContactCompany } from "@/actions/contacts";
import { setDealCompany } from "@/actions/deals";

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type DealRow = {
  id: string;
  title: string;
  stageName: string | null;
  value: number;
};

export function CompanyRelated({
  companyId,
  contacts,
  deals,
  contactOptions,
  dealOptions,
}: {
  companyId: string;
  contacts: ContactRow[];
  deals: DealRow[];
  contactOptions: LinkPickerOption[];
  dealOptions: LinkPickerOption[];
}) {
  const [contactPicker, setContactPicker] = useState(false);
  const [dealPicker, setDealPicker] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Related Data
      </div>

      <RelatedSection
        label="CONTACTS"
        icon={<Users className="h-3 w-3" />}
        rows={contacts}
        getRowId={(c) => c.id}
        getRowHref={(c) => `/contacts/${c.id}`}
        emptyMessage="No contacts linked yet."
        onAdd={() => setContactPicker(true)}
        columns={[
          { key: "name", header: "Name", render: (c) => c.name },
          { key: "email", header: "Email", render: (c) => <RelatedEmail value={c.email} /> },
          { key: "phone", header: "Phone", render: (c) => <RelatedPhone value={c.phone} /> },
        ]}
        remove={{
          title: "Remove contact from company?",
          description: (c) =>
            `“${c.name}” will be unlinked from this company. The contact itself won’t be deleted.`,
          action: (c) => removeContactCompany(c.id, companyId),
        }}
      />

      <RelatedSection
        label="DEALS"
        icon={<Handshake className="h-3 w-3" />}
        rows={deals}
        getRowId={(d) => d.id}
        getRowHref={(d) => `/deals/${d.id}`}
        emptyMessage="No deals linked yet."
        onAdd={() => setDealPicker(true)}
        columns={[
          { key: "title", header: "Title", render: (d) => d.title },
          { key: "stage", header: "Stage", render: (d) => <RelatedMuted value={d.stageName} /> },
          {
            key: "value",
            header: "Value",
            align: "right",
            render: (d) => <RelatedMuted value={d.value.toLocaleString()} />,
          },
        ]}
        remove={{
          title: "Remove deal from company?",
          description: (d) =>
            `“${d.title}” will be unlinked from this company. The deal itself won’t be deleted.`,
          action: (d) => setDealCompany(d.id, null),
        }}
      />

      <LinkPickerDialog
        open={contactPicker}
        onOpenChange={setContactPicker}
        title="Contacts"
        placeholder="Search contacts…"
        icon={<Users className="h-3.5 w-3.5" />}
        options={contactOptions}
        linkedIds={contacts.map((c) => c.id)}
        onLink={(id) => addContactCompany(id, companyId)}
        onUnlink={(id) => removeContactCompany(id, companyId)}
        newHref={`/contacts/new?companyId=${companyId}`}
      />

      <LinkPickerDialog
        open={dealPicker}
        onOpenChange={setDealPicker}
        title="Deals"
        placeholder="Search deals…"
        icon={<Handshake className="h-3.5 w-3.5" />}
        options={dealOptions}
        linkedIds={deals.map((d) => d.id)}
        onLink={(id) => setDealCompany(id, companyId)}
        onUnlink={(id) => setDealCompany(id, null)}
        newHref={`/deals/new?companyId=${companyId}`}
      />
    </div>
  );
}
