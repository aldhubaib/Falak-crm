"use client";

import { useState } from "react";
import { createCompany } from "@/actions/companies";
import { createIndustry, deleteIndustry } from "@/actions/industries";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type IndustryOption = { id: string; name: string };

export function NewCompanyClient({ industries }: { industries: IndustryOption[] }) {
  const router = useRouter();
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [industryList, setIndustryList] = useState(industries);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-8">
        <Link
          href="/dashboard/companies"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">New Company</h1>
      </div>

      <form
        action={async (formData) => {
          formData.set("industry", selectedIndustry);
          const company = await createCompany(formData);
          if (company) router.push(`/dashboard/companies/${company.id}`);
        }}
        className="max-w-2xl space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name" icon={<Building2 className="w-3 h-3" />} name="name" placeholder="Acme Corp" required />
          <ComboboxField
            label="Industry"
            value={selectedIndustry}
            options={industryList.map((i) => ({ id: i.id, label: i.name }))}
            placeholder="Select or add..."
            onSelect={(val) => setSelectedIndustry(val)}
            onCreate={async (name) => {
              const industry = await createIndustry(name);
              setIndustryList((prev) => [...prev, { id: industry.id, name: industry.name }]);
            }}
            onDelete={async (id) => {
              await deleteIndustry(id);
              setIndustryList((prev) => prev.filter((i) => i.id !== id));
              if (industryList.find((i) => i.id === id)?.name === selectedIndustry) {
                setSelectedIndustry("");
              }
            }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Phone" icon={<Phone className="w-3 h-3" />} name="phone" placeholder="+966..." />
          <Field label="WhatsApp" name="whatsappNumber" placeholder="+966..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email" icon={<Mail className="w-3 h-3" />} name="email" placeholder="info@company.com" type="email" />
          <Field label="Website" icon={<Globe className="w-3 h-3" />} name="website" placeholder="https://" />
        </div>
        <Field label="Address" icon={<MapPin className="w-3 h-3" />} name="address" placeholder="Street, City" />

        <div className="pt-2">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            Create Company
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  icon,
  name,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  icon?: React.ReactNode;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
      />
    </div>
  );
}
