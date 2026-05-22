"use client";

import { useState } from "react";
import { updateCompany } from "@/actions/companies";
import { InputField, TextareaField } from "@/components/ui/field";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Phone, StickyNote, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  whatsappNumber: string | null;
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
  industry: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  contacts: Contact[];
  deals: Deal[];
};

export function CompanyDetailClient({ company }: { company: Company }) {
  const { user } = useUser();
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(company.notes || "[]"); } catch { return []; }
  });
  const [newNoteText, setNewNoteText] = useState("");

  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set("name", company.name);
    formData.set(field, value);
    await updateCompany(company.id, formData);
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
    await updateCompany(company.id, formData);
  };

  const removeNote = async (index: number) => {
    const updated = notes.filter((_, i) => i !== index);
    setNotes(updated);
    const formData = new FormData();
    formData.set("notes", JSON.stringify(updated));
    await updateCompany(company.id, formData);
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
        <h1 className="text-lg font-semibold text-foreground">{company.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fields */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Company Name"
              icon={<Building2 className="w-3 h-3" />}
              value={company.name}
              onSave={save("name")}
            />
            <InputField
              label="Industry"
              value={company.industry || ""}
              placeholder="e.g. Technology, Retail"
              onSave={save("industry")}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Phone"
              icon={<Phone className="w-3 h-3" />}
              value={company.phone || ""}
              placeholder="+966..."
              onSave={save("phone")}
            />
            <InputField
              label="WhatsApp"
              value={company.whatsappNumber || ""}
              placeholder="+966..."
              onSave={save("whatsappNumber")}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Email"
              icon={<Mail className="w-3 h-3" />}
              value={company.email || ""}
              placeholder="info@company.com"
              type="email"
              onSave={save("email")}
            />
            <InputField
              label="Website"
              icon={<Globe className="w-3 h-3" />}
              value={company.website || ""}
              placeholder="https://"
              onSave={save("website")}
            />
          </div>
          <InputField
            label="Address"
            icon={<MapPin className="w-3 h-3" />}
            value={company.address || ""}
            placeholder="Street, City"
            onSave={save("address")}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contacts */}
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Contacts ({company.contacts.length})
            </h3>
            {company.contacts.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No contacts</p>
            ) : (
              <div className="space-y-2">
                {company.contacts.map((contact) => (
                  <div key={contact.id} className="p-2 rounded-lg bg-muted/30">
                    <p className="text-[13px] text-foreground">{contact.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {contact.role || "No role"}
                      {contact.whatsappNumber && ` • ${contact.whatsappNumber}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deals */}
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Deals ({company.deals.length})
            </h3>
            {company.deals.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No deals</p>
            ) : (
              <div className="space-y-2">
                {company.deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/dashboard/deals/${deal.id}`}
                    className="p-2 rounded-lg bg-muted/30 block no-underline hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-[13px] text-foreground">{deal.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deal.stage.color }} />
                      <span className="text-[11px] text-muted-foreground">
                        {deal.stage.name} • {Number(deal.value).toLocaleString()} SAR
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-8" />

      {/* Notes Section */}
      <div>
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-4">
          <StickyNote className="w-4 h-4" />
          Notes
        </h2>

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
          className="w-full px-3 py-2.5 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none mb-4"
        />

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
    </div>
  );
}
