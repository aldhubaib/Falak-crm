"use client";

import { useState } from "react";
import { createCompany } from "@/actions/companies";
import { createIndustry, deleteIndustry } from "@/actions/industries";
import { createReferral, deleteReferral } from "@/actions/referrals";
import { ComboboxField } from "@/components/ui/combobox-field";
import { FormField } from "@/components/ui/form-field";
import { RecordOwner } from "@/components/ui/record-owner";
import { FIELD_REGISTRY, validateFields } from "@/lib/fields";
import { ArrowLeft, Globe, Save } from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { countryOptions } from "@/lib/countries";
import { useErrorStore } from "@/lib/error-store";

type OptionItem = { id: string; name: string };

export function NewCompanyClient({ industries, referrals, currentUserName }: { industries: OptionItem[]; referrals: OptionItem[]; currentUserName: string }) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [industryList, setIndustryList] = useState(industries);
  const [referralList, setReferralList] = useState(referrals);
  const [values, setValues] = useState<Record<string, string>>({
    name: "",
    nameAr: "",
    industry: "",
    country: "",
    referral: "",
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const { [key]: _, ...rest } = prev; return rest; });
  };

  const validate = () => {
    const fieldsToValidate = [
      FIELD_REGISTRY.companyName,
      FIELD_REGISTRY.companyNameAr,
      FIELD_REGISTRY.industry,
      FIELD_REGISTRY.country,
      FIELD_REGISTRY.referral,
    ];
    const errs = validateFields(fieldsToValidate, values);
    setErrors(errs);
    return Object.keys(errs).length === 0;
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
        <h1 className="text-lg font-semibold text-foreground flex-1">New Company</h1>
        <Button type="submit" form="company-form">
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>
      </div>

      <form
        id="company-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validate()) return;
          const formData = new FormData();
          formData.set("name", values.name);
          formData.set("nameAr", values.nameAr);
          formData.set("industry", values.industry);
          formData.set("address", values.country);
          formData.set("referral", values.referral);
          if (values.website) formData.set("website", values.website);
          const result = await createCompany(formData);
          if (result.ok) {
            router.push(`/dashboard/companies/${result.data.id}`);
          } else {
            pushError(result.error);
          }
        }}
        className="space-y-5"
      >
        <AvatarUpload name="logo" fallback="C" size="lg" />

        <RecordOwner ownerName={currentUserName} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField def={FIELD_REGISTRY.companyName} value={values.name} error={errors.name} onChange={(v) => setValue("name", v)} />
          <FormField def={FIELD_REGISTRY.companyNameAr} value={values.nameAr} error={errors.nameAr} onChange={(v) => setValue("nameAr", v)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(errors.industry && "shake")}>
            <ComboboxField
              label="Industry"
              required
              value={values.industry}
              options={industryList.map((i) => ({ id: i.id, label: i.name }))}
              placeholder="Select or add..."
              error={!!errors.industry}
              onSelect={(val) => setValue("industry", val)}
              onCreate={async (name) => {
                const industry = await createIndustry(name);
                setIndustryList((prev) => [...prev, { id: industry.id, name: industry.name }]);
              }}
              onDelete={async (id) => {
                await deleteIndustry(id);
                setIndustryList((prev) => prev.filter((i) => i.id !== id));
                if (industryList.find((i) => i.id === id)?.name === values.industry) {
                  setValue("industry", "");
                }
              }}
            />
            {errors.industry && (
              <p className="text-[11px] text-destructive mt-1">{errors.industry}</p>
            )}
          </div>
          <div className={cn(errors.country && "shake")}>
            <ComboboxField
              label="Country"
              icon={<Globe className="w-3 h-3" />}
              required
              value={values.country}
              options={countryOptions()}
              placeholder="Select country..."
              error={!!errors.country}
              onSelect={(val) => setValue("country", val)}
            />
            {errors.country && (
              <p className="text-[11px] text-destructive mt-1">{errors.country}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(errors.referral && "shake")}>
            <ComboboxField
              label="Referral"
              required
              value={values.referral}
              options={referralList.map((r) => ({ id: r.id, label: r.name }))}
              placeholder="Select or add..."
              error={!!errors.referral}
              onSelect={(val) => setValue("referral", val)}
              onCreate={async (name) => {
                const referral = await createReferral(name);
                setReferralList((prev) => [...prev, { id: referral.id, name: referral.name }]);
              }}
              onDelete={async (id) => {
                await deleteReferral(id);
                setReferralList((prev) => prev.filter((r) => r.id !== id));
                if (referralList.find((r) => r.id === id)?.name === values.referral) {
                  setValue("referral", "");
                }
              }}
            />
            {errors.referral && (
              <p className="text-[11px] text-destructive mt-1">{errors.referral}</p>
            )}
          </div>
          <FormField def={FIELD_REGISTRY.website} value={values.website} error={errors.website} onChange={(v) => setValue("website", v)} />
        </div>
      </form>
    </div>
  );
}
