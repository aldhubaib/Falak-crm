"use client";

import { updateCompany } from "@/actions/companies";
import { InputField, TextareaField } from "@/components/ui/field";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
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
  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set("name", company.name);
    formData.set(field, value);
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
          <TextareaField
            label="Notes"
            value={company.notes || ""}
            placeholder="Internal notes..."
            onSave={save("notes")}
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
    </div>
  );
}
