"use client";

// The "Related Data" block shared by the company, contact and deal detail
// pages (design + behavior from Lovable). One component — change it here and
// it changes on every page:
//
//   company → CONTACTS + DEALS
//   contact → COMPANIES + DEALS
//   deal    → COMPANY + CONTACTS (contacts of the linked company)
//
// Each section is a small table with a "+" picker to link/unlink records and
// a per-row "…" → Remove (unlink only — never deletes the record itself).

import { useState } from "react";
import { Building2, Handshake, Users } from "lucide-react";
import {
  LinkPickerDialog,
  RelatedEmail,
  RelatedMuted,
  RelatedPhone,
  RelatedSection,
  type LinkPickerOption,
  type RelatedColumn,
} from "@/components/crm/related-data";
import { addContactCompany, removeContactCompany } from "@/actions/contacts";
import { setDealCompany, setDealContact } from "@/actions/deals";

export type RelatedPartyRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type RelatedDealRow = {
  id: string;
  title: string;
  stageName: string | null;
  value: number;
};

export type RelatedEntity =
  | { type: "company"; id: string }
  | { type: "contact"; id: string }
  | { type: "deal"; id: string; companyId: string | null; companyName?: string | null };

const PARTY_COLUMNS: RelatedColumn<RelatedPartyRow>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "email", header: "Email", render: (r) => <RelatedEmail value={r.email} /> },
  { key: "phone", header: "Phone", render: (r) => <RelatedPhone value={r.phone} /> },
];

const DEAL_COLUMNS: RelatedColumn<RelatedDealRow>[] = [
  { key: "title", header: "Title", render: (d) => d.title },
  { key: "stage", header: "Stage", render: (d) => <RelatedMuted value={d.stageName} /> },
  {
    key: "value",
    header: "Value",
    align: "right",
    render: (d) => <RelatedMuted value={d.value.toLocaleString()} />,
  },
];

export function RelatedData({
  entity,
  companies = [],
  contacts = [],
  deals = [],
  companyOptions = [],
  contactOptions = [],
  dealOptions = [],
}: {
  entity: RelatedEntity;
  /** Linked company rows (contact → its companies, deal → its company). */
  companies?: RelatedPartyRow[];
  /** Linked contact rows (company → its contacts, deal → its company's contacts). */
  contacts?: RelatedPartyRow[];
  /** Linked deal rows (company/contact → their deals). */
  deals?: RelatedDealRow[];
  companyOptions?: LinkPickerOption[];
  contactOptions?: LinkPickerOption[];
  dealOptions?: LinkPickerOption[];
}) {
  const [companyPicker, setCompanyPicker] = useState(false);
  const [contactPicker, setContactPicker] = useState(false);
  const [dealPicker, setDealPicker] = useState(false);

  // The company that contact links attach to: the entity itself on the
  // company page, the deal's linked company on the deal page.
  const contactsCompanyId =
    entity.type === "company"
      ? entity.id
      : entity.type === "deal"
        ? entity.companyId
        : null;

  const companiesSection = entity.type !== "company" && (
    <RelatedSection
      label={entity.type === "deal" ? "COMPANY" : "COMPANIES"}
      icon={<Building2 className="h-3 w-3" />}
      rows={companies}
      getRowId={(c) => c.id}
      getRowHref={(c) => `/companies/${c.id}`}
      emptyMessage="No company linked yet."
      onAdd={() => setCompanyPicker(true)}
      columns={PARTY_COLUMNS}
      remove={{
        title: "Remove company link?",
        description: (c) =>
          `“${c.name}” will be unlinked. The company itself won’t be deleted.`,
        action: (c) =>
          entity.type === "deal"
            ? setDealCompany(entity.id, null)
            : removeContactCompany(entity.id, c.id),
      }}
    />
  );

  const contactsSection = entity.type !== "contact" &&
    (entity.type === "company" || entity.companyId) && (
      <RelatedSection
        label="CONTACTS"
        icon={<Users className="h-3 w-3" />}
        rows={contacts}
        getRowId={(c) => c.id}
        getRowHref={(c) => `/contacts/${c.id}`}
        emptyMessage="No contacts linked yet."
        onAdd={() => setContactPicker(true)}
        columns={PARTY_COLUMNS}
        remove={{
          title: "Remove contact from company?",
          description: (c) =>
            `“${c.name}” will be unlinked from ${
              entity.type === "deal" && entity.companyName
                ? entity.companyName
                : "this company"
            }. The contact itself won’t be deleted.`,
          action: (c) =>
            contactsCompanyId
              ? removeContactCompany(c.id, contactsCompanyId)
              : Promise.resolve({ ok: true as const, data: undefined }),
        }}
      />
    );

  const dealsSection = entity.type !== "deal" && (
    <RelatedSection
      label="DEALS"
      icon={<Handshake className="h-3 w-3" />}
      rows={deals}
      getRowId={(d) => d.id}
      getRowHref={(d) => `/deals/${d.id}`}
      emptyMessage="No deals linked yet."
      onAdd={() => setDealPicker(true)}
      columns={DEAL_COLUMNS}
      remove={{
        title:
          entity.type === "company"
            ? "Remove deal from company?"
            : "Remove deal from contact?",
        description: (d) =>
          `“${d.title}” will be unlinked. The deal itself won’t be deleted.`,
        action: (d) =>
          entity.type === "company"
            ? setDealCompany(d.id, null)
            : setDealContact(d.id, null),
      }}
    />
  );

  return (
    <div className="space-y-3">
      <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Related Data
      </div>

      {companiesSection}
      {contactsSection}
      {dealsSection}

      {entity.type !== "company" && (
        <LinkPickerDialog
          open={companyPicker}
          onOpenChange={setCompanyPicker}
          title="Companies"
          placeholder="Search companies…"
          icon={<Building2 className="h-3.5 w-3.5" />}
          options={companyOptions}
          linkedIds={companies.map((c) => c.id)}
          onLink={(id) =>
            entity.type === "deal"
              ? setDealCompany(entity.id, id)
              : addContactCompany(entity.id, id)
          }
          onUnlink={(id) =>
            entity.type === "deal"
              ? setDealCompany(entity.id, null)
              : removeContactCompany(entity.id, id)
          }
          newHref="/companies/new"
        />
      )}

      {entity.type !== "contact" && contactsCompanyId && (
        <LinkPickerDialog
          open={contactPicker}
          onOpenChange={setContactPicker}
          title="Contacts"
          placeholder="Search contacts…"
          icon={<Users className="h-3.5 w-3.5" />}
          options={contactOptions}
          linkedIds={contacts.map((c) => c.id)}
          onLink={(id) => addContactCompany(id, contactsCompanyId)}
          onUnlink={(id) => removeContactCompany(id, contactsCompanyId)}
          newHref={`/contacts/new?companyId=${contactsCompanyId}`}
        />
      )}

      {entity.type !== "deal" && (
        <LinkPickerDialog
          open={dealPicker}
          onOpenChange={setDealPicker}
          title="Deals"
          placeholder="Search deals…"
          icon={<Handshake className="h-3.5 w-3.5" />}
          options={dealOptions}
          linkedIds={deals.map((d) => d.id)}
          onLink={(id) =>
            entity.type === "company"
              ? setDealCompany(id, entity.id)
              : setDealContact(id, entity.id)
          }
          onUnlink={(id) =>
            entity.type === "company"
              ? setDealCompany(id, null)
              : setDealContact(id, null)
          }
          newHref={
            entity.type === "company"
              ? `/deals/new?companyId=${entity.id}`
              : "/deals/new"
          }
        />
      )}
    </div>
  );
}
