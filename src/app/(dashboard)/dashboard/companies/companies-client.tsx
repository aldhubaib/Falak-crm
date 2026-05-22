"use client";

import { useState } from "react";
import { createCompany, deleteCompany } from "@/actions/companies";
import { Plus, Trash2, X, Building2, Users, Handshake } from "lucide-react";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  _count: { contacts: number; deals: number; projects: number };
};

export function CompaniesClient({ companies }: { companies: Company[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Companies</h1>
        <button
          onClick={() => setShowForm(true)}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Company
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-foreground">New Company</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form
            action={async (formData) => {
              await createCompany(formData);
              setShowForm(false);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <input
                name="name"
                placeholder="Company name *"
                required
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="industry"
                placeholder="Industry"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="phone"
                placeholder="Phone"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="whatsappNumber"
                placeholder="WhatsApp number"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="email"
                placeholder="Email"
                type="email"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="website"
                placeholder="Website"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <input
              name="address"
              placeholder="Address"
              className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              Create Company
            </button>
          </form>
        </div>
      )}

      {companies.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No companies yet. Add your first client to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/dashboard/companies/${company.id}`}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors no-underline block"
            >
              <div>
                <h3 className="text-[13px] font-medium text-foreground">
                  {company.name}
                </h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {company.industry || "No industry"}
                  {company.whatsappNumber && ` • ${company.whatsappNumber}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {company._count.contacts}
                </span>
                <span className="flex items-center gap-1">
                  <Handshake className="w-3 h-3" /> {company._count.deals}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
