"use client";

import { useState } from "react";
import { createCompany, deleteCompany } from "@/actions/companies";
import { Plus, Trash2, Users, Handshake } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Companies</h1>
        <button
          onClick={() => setCreating(true)}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Company
        </button>
      </div>

      {creating && (
        <form
          action={async (formData) => {
            const company = await createCompany(formData);
            setCreating(false);
            if (company) router.push(`/dashboard/companies/${company.id}`);
          }}
          className="mb-4 flex items-center gap-3"
        >
          <input
            name="name"
            placeholder="Company name..."
            required
            autoFocus
            className="flex-1 h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <span className="text-[11px] text-muted-foreground">
            Enter to create • Esc to cancel
          </span>
        </form>
      )}

      {companies.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          No companies yet. Add your first client to get started.
        </div>
      ) : (
        <div className="space-y-1">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/dashboard/companies/${company.id}`}
              className="rounded-lg p-3 flex items-center justify-between hover:bg-card transition-colors no-underline block"
            >
              <div>
                <h3 className="text-[13px] font-medium text-foreground">
                  {company.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
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
