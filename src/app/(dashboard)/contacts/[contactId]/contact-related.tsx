"use client";

// Related Data for a contact: linked companies and deals, rendered with the
// shared RelatedSection/LinkPickerDialog components.

import { useState } from "react";
import { Building2, Handshake } from "lucide-react";
import {
  LinkPickerDialog,
  RelatedEmail,
  RelatedMuted,
  RelatedPhone,
  RelatedSection,
  type LinkPickerOption,
} from "@/components/crm/related-data";
import { addContactCompany, removeContactCompany } from "@/actions/contacts";
import { setDealContact } from "@/actions/deals";

type CompanyRow = {
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

export function ContactRelated({
  contactId,
  companies,
  deals,
  companyOptions,
  dealOptions,
}: {
  contactId: string;
  companies: CompanyRow[];
  deals: DealRow[];
  companyOptions: LinkPickerOption[];
  dealOptions: LinkPickerOption[];
}) {
  const [companyPicker, setCompanyPicker] = useState(false);
  const [dealPicker, setDealPicker] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Related Data
      </div>

      <RelatedSection
        label="COMPANY"
        icon={<Building2 className="h-3 w-3" />}
        rows={companies}
        getRowId={(c) => c.id}
        getRowHref={(c) => `/companies/${c.id}`}
        emptyMessage="No company linked yet."
        onAdd={() => setCompanyPicker(true)}
        columns={[
          { key: "name", header: "Name", render: (c) => c.name },
          { key: "email", header: "Email", render: (c) => <RelatedEmail value={c.email} /> },
          { key: "phone", header: "Phone", render: (c) => <RelatedPhone value={c.phone} /> },
        ]}
        remove={{
          title: "Remove company link?",
          description: (c) =>
            `“${c.name}” will be unlinked. The company itself won’t be deleted.`,
          action: (c) => removeContactCompany(contactId, c.id),
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
          title: "Remove deal from contact?",
          description: (d) =>
            `“${d.title}” will be unlinked from this contact. The deal itself won’t be deleted.`,
          action: (d) => setDealContact(d.id, null),
        }}
      />

      <LinkPickerDialog
        open={companyPicker}
        onOpenChange={setCompanyPicker}
        title="Companies"
        placeholder="Search companies…"
        icon={<Building2 className="h-3.5 w-3.5" />}
        options={companyOptions}
        linkedIds={companies.map((c) => c.id)}
        onLink={(id) => addContactCompany(contactId, id)}
        onUnlink={(id) => removeContactCompany(contactId, id)}
        newHref="/companies/new"
      />

      <LinkPickerDialog
        open={dealPicker}
        onOpenChange={setDealPicker}
        title="Deals"
        placeholder="Search deals…"
        icon={<Handshake className="h-3.5 w-3.5" />}
        options={dealOptions}
        linkedIds={deals.map((d) => d.id)}
        onLink={(id) => setDealContact(id, contactId)}
        onUnlink={(id) => setDealContact(id, null)}
        newHref="/deals/new"
      />
    </div>
  );
}
