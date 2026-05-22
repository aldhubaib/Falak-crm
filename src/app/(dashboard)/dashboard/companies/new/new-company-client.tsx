"use client";

import { useState, useRef } from "react";
import { createCompany } from "@/actions/companies";
import { createIndustry, deleteIndustry } from "@/actions/industries";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ArrowLeft, Building2, Globe } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type IndustryOption = { id: string; name: string };

const countries = [
  "Saudi Arabia", "Kuwait", "UAE", "Bahrain", "Qatar", "Oman",
  "Egypt", "Jordan", "Lebanon", "Iraq", "Morocco", "Tunisia",
  "United States", "United Kingdom", "Germany", "France",
  "Canada", "Australia", "India", "Pakistan", "Turkey",
];

export function NewCompanyClient({ industries }: { industries: IndustryOption[] }) {
  const router = useRouter();
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [industryList, setIndustryList] = useState(industries);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const newErrors: Record<string, boolean> = {};
    if (!nameRef.current?.value.trim()) newErrors.name = true;
    if (!selectedIndustry) newErrors.industry = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div className="p-6">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        .shake { animation: shake 0.4s ease-in-out; }
      `}</style>

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
          if (!validate()) return;
          formData.set("industry", selectedIndustry);
          formData.set("address", selectedCountry);
          const company = await createCompany(formData);
          if (company) router.push(`/dashboard/companies/${company.id}`);
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(errors.name && "shake")}>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Building2 className="w-3 h-3" />
              Company Name
              <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameRef}
              name="name"
              placeholder="Acme Corp"
              onChange={() => errors.name && setErrors((e) => ({ ...e, name: false }))}
              className={cn(
                "w-full h-10 px-3 rounded-lg bg-transparent border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
                errors.name ? "border-destructive focus:border-destructive" : "border-border focus:border-ring"
              )}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive mt-1">Company name is required</p>
            )}
          </div>
          <div className={cn(errors.industry && "shake")}>
            <ComboboxField
              label="Industry"
              required
              value={selectedIndustry}
              options={industryList.map((i) => ({ id: i.id, label: i.name }))}
              placeholder="Select or add..."
              error={errors.industry}
              onSelect={(val) => {
                setSelectedIndustry(val);
                if (errors.industry) setErrors((e) => ({ ...e, industry: false }));
              }}
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
            {errors.industry && (
              <p className="text-[11px] text-destructive mt-1">Industry is required</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Globe className="w-3 h-3" />
              Country
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground appearance-none focus:outline-none focus:border-ring transition-colors cursor-pointer"
            >
              <option value="">Select country...</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Globe className="w-3 h-3" />
              Website
            </label>
            <input
              name="website"
              placeholder="https://"
              className="w-full h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
            />
          </div>
        </div>

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
