"use client";

import { updateContact } from "@/actions/contacts";
import { InputField, PhoneField, EmailField, CountryField, SelectField } from "@/components/ui/field";
import { ActionMenu } from "@/components/ui/action-menu";
import { RelatedTable, type RelatedColumn } from "@/components/ui/related-table";
import { ArrowLeft, User, MapPin, Handshake, Building2 } from "lucide-react";
import Link from "next/link";

type Deal = {
  id: string;
  title: string;
  value: unknown;
  stage: { name: string; color: string };
};

type Contact = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  nameAr: string | null;
  mobile: string;
  email: string | null;
  role: string | null;
  country: string;
  company: { id: string; name: string } | null;
  deals: Deal[];
};

export function ContactDetailClient({ contact, companies }: { contact: Contact; companies: { id: string; name: string }[] }) {
  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set(field, value);
    await updateContact(contact.id, formData);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/contacts"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">
          {contact.firstName} {contact.middleName ? `${contact.middleName} ` : ""}{contact.lastName}
        </h1>
        <ActionMenu
          entityType="contact"
          entityId={contact.id}
          entityName={`${contact.firstName} ${contact.lastName}`}
          redirectAfterDelete="/dashboard/contacts"
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="First Name"
            icon={<User className="w-3 h-3" />}
            value={contact.firstName}
            onSave={save("firstName")}
          />
          <InputField
            label="Middle Name"
            value={contact.middleName || ""}
            placeholder="—"
            onSave={save("middleName")}
          />
          <InputField
            label="Last Name"
            value={contact.lastName}
            onSave={save("lastName")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="الاسم بالعربي (Arabic Name)"
            value={contact.nameAr || ""}
            placeholder="الاسم الكامل بالعربي"
            dir="rtl"
            onSave={save("nameAr")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PhoneField
            label="Mobile"
            value={contact.mobile}
            onSave={save("mobile")}
          />
          <EmailField
            label="Email"
            value={contact.email || ""}
            placeholder="—"
            onSave={save("email")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="Role"
            value={contact.role || ""}
            placeholder="Title / Position"
            onSave={save("role")}
          />
          <CountryField
            label="Country"
            icon={<MapPin className="w-3 h-3" />}
            value={contact.country}
            onSave={save("country")}
          />
          <SelectField
            label="Company"
            icon={<Building2 className="w-3 h-3" />}
            value={contact.company?.id || ""}
            placeholder="No company"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            onSave={save("companyId")}
          />
        </div>
      </div>

      {/* Deals Table */}
      <div className="border-t border-border my-8" />
      <RelatedTable
        icon={<Handshake className="w-3 h-3" />}
        title="Deals"
        data={contact.deals}
        getRowId={(r) => r.id}
        rowHref={(r) => `/dashboard/deals/${r.id}`}
        columns={contactDealColumns}
      />
    </div>
  );
}

const contactDealColumns: RelatedColumn<{ id: string; title: string; value: unknown; stage: { name: string; color: string } }>[] = [
  {
    key: "title",
    label: "Title",
    render: (r) => <span className="text-foreground font-medium">{r.title}</span>,
  },
  {
    key: "stage",
    label: "Stage",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.stage.color }} />
        {r.stage.name}
      </span>
    ),
  },
  {
    key: "value",
    label: "Value",
    align: "right",
    render: (r) => <span className="text-foreground">{Number(r.value).toLocaleString()} KWD</span>,
  },
];
