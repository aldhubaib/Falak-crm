"use client";

import { useState } from "react";
import { updateCompany } from "@/actions/companies";
import { InputField, CountryField, SelectField } from "@/components/ui/field";
import { ActionMenu } from "@/components/ui/action-menu";
import { RelatedTable, type RelatedColumn } from "@/components/ui/related-table";
import { AddContactForm } from "@/components/add-contact-form";
import { AddDealForm } from "@/components/add-deal-form";
import { ArrowLeft, Building2, Globe, MapPin, StickyNote, Trash2, Handshake, Users } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { useUser } from "@clerk/nextjs";
import { useErrorStore } from "@/lib/error-store";
import Link from "next/link";

type Contact = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  mobile: string;
  email: string | null;
  role: string | null;
  country: string;
};

type Deal = {
  id: string;
  title: string;
  value: unknown;
  stage: { name: string; color: string };
};

type Note = { date: string; text: string; userName?: string; userImage?: string };

type Company = {
  id: string;
  name: string;
  nameAr: string | null;
  industry: string | null;
  referral: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  contacts: Contact[];
  deals: Deal[];
};

type Option = { id: string; name: string };

export function CompanyDetailClient({
  company,
  industries,
  referrals,
}: {
  company: Company;
  industries: Option[];
  referrals: Option[];
}) {
  const { user } = useUser();
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(company.notes || "[]"); } catch { return []; }
  });
  const [newNoteText, setNewNoteText] = useState("");

  const { push: pushError } = useErrorStore();

  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set("name", company.name);
    formData.set(field, value);
    const result = await updateCompany(company.id, formData);
    if (!result.ok) pushError(result.error);
  };

  const addNote = async () => {
    if (!newNoteText.trim()) return;
    const updated = [...notes, {
      date: new Date().toISOString(),
      text: newNoteText.trim(),
      userName: user?.fullName || user?.firstName || undefined,
      userImage: user?.imageUrl || undefined,
    }];
    setNotes(updated);
    setNewNoteText("");
    const formData = new FormData();
    formData.set("notes", JSON.stringify(updated));
    const result = await updateCompany(company.id, formData);
    if (!result.ok) pushError(result.error);
  };

  const removeNote = async (index: number) => {
    const updated = notes.filter((_, i) => i !== index);
    setNotes(updated);
    const formData = new FormData();
    formData.set("notes", JSON.stringify(updated));
    const result = await updateCompany(company.id, formData);
    if (!result.ok) pushError(result.error);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/companies"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">{company.name}</h1>
        <ActionMenu
          entityType="company"
          entityId={company.id}
          entityName={company.name}
          redirectAfterDelete="/dashboard/companies"
        />
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Company Name"
            icon={<Building2 className="w-3 h-3" />}
            value={company.name}
            onSave={save("name")}
          />
          <InputField
            label="Company Name (Arabic)"
            icon={<Building2 className="w-3 h-3" />}
            value={company.nameAr || ""}
            placeholder="اسم الشركة"
            dir="rtl"
            onSave={save("nameAr")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Industry"
            value={company.industry || ""}
            options={industries.map((i) => ({ value: i.name, label: i.name }))}
            placeholder="Select industry..."
            onSave={save("industry")}
          />
          <SelectField
            label="Referral"
            value={company.referral || ""}
            options={referrals.map((r) => ({ value: r.name, label: r.name }))}
            placeholder="Select referral..."
            onSave={save("referral")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CountryField
            label="Country"
            icon={<MapPin className="w-3 h-3" />}
            value={company.address || ""}
            onSave={save("address")}
          />
          <InputField
            label="Website"
            icon={<Globe className="w-3 h-3" />}
            value={company.website || ""}
            placeholder="https://"
            onSave={save("website")}
          />
        </div>
      </div>

      {/* Notes Section */}
      <div className="border-t border-border my-8" />
      <div>
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 mb-4 focus-within:border-ring transition-colors">
          <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <StickyNote className="w-3 h-3" />
            Notes
          </label>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Write a note and press Enter..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addNote();
              }
            }}
            className="w-full py-1.5 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none"
          />
        </div>

        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((note, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border group"
              >
                {note.userImage ? (
                  <img src={note.userImage} alt="" className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                    {(note.userName || "?").charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground">{note.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {note.userName && <span className="font-medium">{note.userName}</span>}
                    {note.userName && " • "}
                    {new Date(note.date).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeNote(i)}
                  className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contacts Table */}
      <div className="border-t border-border my-8" />
      <RelatedTable
        icon={<Users className="w-3 h-3" />}
        title="Contacts"
        data={company.contacts}
        getRowId={(r) => r.id}
        rowHref={(r) => `/dashboard/contacts/${r.id}`}
        action={<AddContactForm companyId={company.id} />}
        columns={contactColumns}
      />

      {/* Deals Table */}
      <div className="border-t border-border my-8" />
      <RelatedTable
        icon={<Handshake className="w-3 h-3" />}
        title="Deals"
        data={company.deals}
        getRowId={(r) => r.id}
        rowHref={(r) => `/dashboard/deals/${r.id}`}
        action={<AddDealForm companyId={company.id} contacts={company.contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))} />}
        columns={dealColumns}
      />
    </div>
  );
}

const contactColumns: RelatedColumn<Contact>[] = [
  {
    key: "name",
    label: "Name",
    render: (r) => <span className="text-foreground font-medium">{r.firstName} {r.lastName}</span>,
  },
  { key: "mobile", label: "Mobile" },
  {
    key: "country",
    label: "Country",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        {getCountryFlag(r.country) && <span>{getCountryFlag(r.country)}</span>}
        {r.country}
      </span>
    ),
  },
  { key: "role", label: "Role" },
];

const dealColumns: RelatedColumn<Deal>[] = [
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
