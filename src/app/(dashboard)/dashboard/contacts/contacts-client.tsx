"use client";

import { useState } from "react";
import { createContact, deleteContact } from "@/actions/contacts";
import { Plus, Trash2 } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  company: { id: string; name: string } | null;
};

type CompanyOption = { id: string; name: string };

export function ContactsClient({
  contacts,
  companies,
}: {
  contacts: Contact[];
  companies: CompanyOption[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Contacts</h1>
        <button
          onClick={() => setCreating(true)}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </button>
      </div>

      {creating && (
        <form
          action={async (formData) => {
            await createContact(formData);
            setCreating(false);
          }}
          className="mb-4 rounded-lg border border-border p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
              <input
                name="name"
                placeholder="Full name"
                required
                autoFocus
                className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Company</label>
              <select
                name="companyId"
                className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground appearance-none focus:outline-none focus:border-ring"
              >
                <option value="">None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Role</label>
              <input name="role" placeholder="Title" className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">WhatsApp</label>
              <input name="whatsappNumber" placeholder="+966..." className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
              <input name="email" type="email" placeholder="email@..." className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="h-8 px-3 rounded-lg text-[12px] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          No contacts yet.
        </div>
      ) : (
        <div className="space-y-1">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="rounded-lg p-3 flex items-center justify-between hover:bg-card transition-colors group"
            >
              <div>
                <h3 className="text-[13px] font-medium text-foreground">
                  {contact.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {contact.role || "No role"}
                  {contact.company && ` • ${contact.company.name}`}
                  {contact.whatsappNumber && ` • ${contact.whatsappNumber}`}
                </p>
              </div>
              <form action={deleteContact.bind(null, contact.id)}>
                <button
                  type="submit"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
