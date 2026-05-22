"use client";

import { useState } from "react";
import { createContact, deleteContact } from "@/actions/contacts";
import { Plus, Trash2, X } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Contacts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-foreground">New Contact</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form
            action={async (formData) => {
              await createContact(formData);
              setShowForm(false);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <input
                name="name"
                placeholder="Full name *"
                required
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                name="companyId"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                name="role"
                placeholder="Role / Title"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="whatsappNumber"
                placeholder="WhatsApp number"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="email"
                placeholder="Email"
                type="email"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              Create Contact
            </button>
          </form>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No contacts yet. Add contacts to your companies.
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="text-[13px] font-medium text-foreground">
                  {contact.name}
                </h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {contact.role || "No role"}
                  {contact.company && ` • ${contact.company.name}`}
                  {contact.whatsappNumber && ` • ${contact.whatsappNumber}`}
                </p>
              </div>
              <form action={deleteContact.bind(null, contact.id)}>
                <button
                  type="submit"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
