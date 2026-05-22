"use client";

import { useState } from "react";
import { createContact } from "@/actions/contacts";
import { ComboboxField } from "@/components/ui/combobox-field";
import { FormField } from "@/components/ui/form-field";
import { FIELD_REGISTRY, validateFields, type FieldDef } from "@/lib/fields";
import { ArrowLeft, Save, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { countryOptions } from "@/lib/countries";

type CompanyOption = { id: string; name: string };

const FORM_FIELDS: FieldDef[] = [
  FIELD_REGISTRY.firstName,
  FIELD_REGISTRY.middleName,
  FIELD_REGISTRY.lastName,
  FIELD_REGISTRY.nameAr,
  FIELD_REGISTRY.mobile,
  FIELD_REGISTRY.email,
  FIELD_REGISTRY.role,
  FIELD_REGISTRY.country,
];

export function NewContactClient({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({
    firstName: "",
    middleName: "",
    lastName: "",
    nameAr: "",
    mobile: "",
    email: "",
    role: "",
    country: "",
    companyId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const { [key]: _, ...rest } = prev; return rest; });
  };

  const validate = () => {
    const errs = validateFields(FORM_FIELDS, values);
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
          href="/dashboard/contacts"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">New Contact</h1>
        <Button type="submit" form="contact-form">
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>
      </div>

      <form
        id="contact-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validate()) return;
          const formData = new FormData();
          for (const [k, v] of Object.entries(values)) {
            if (v) formData.set(k, v);
          }
          const result = await createContact(formData);
          if (result && "error" in result) {
            setErrors({ mobile: result.error });
            return;
          }
          if (result) router.push(`/dashboard/contacts/${result.id}`);
        }}
        className="space-y-5"
      >
        {/* Name fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField def={FIELD_REGISTRY.firstName} value={values.firstName} error={errors.firstName} onChange={(v) => setValue("firstName", v)} />
          <FormField def={FIELD_REGISTRY.middleName} value={values.middleName} error={errors.middleName} onChange={(v) => setValue("middleName", v)} />
          <FormField def={FIELD_REGISTRY.lastName} value={values.lastName} error={errors.lastName} onChange={(v) => setValue("lastName", v)} />
        </div>

        {/* Arabic name */}
        <FormField def={FIELD_REGISTRY.nameAr} value={values.nameAr} error={errors.nameAr} onChange={(v) => setValue("nameAr", v)} />

        {/* Mobile & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField def={FIELD_REGISTRY.mobile} value={values.mobile} error={errors.mobile} onChange={(v) => setValue("mobile", v)} />
          <FormField def={FIELD_REGISTRY.email} value={values.email} error={errors.email} onChange={(v) => setValue("email", v)} />
        </div>

        {/* Role & Country */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField def={FIELD_REGISTRY.role} value={values.role} error={errors.role} onChange={(v) => setValue("role", v)} />
          <div className={cn(errors.country && "shake")}>
            <ComboboxField
              label="Country"
              icon={<MapPin className="w-3 h-3" />}
              value={values.country}
              options={countryOptions()}
              placeholder="Select country..."
              required
              error={!!errors.country}
              onSelect={(val) => setValue("country", val)}
            />
            {errors.country && (
              <p className="text-[11px] text-destructive mt-1">{errors.country}</p>
            )}
          </div>
        </div>

        {/* Company */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComboboxField
            label="Company"
            value={values.companyId}
            options={companies.map((c) => ({ id: c.id, label: c.name }))}
            placeholder="Select company..."
            selectById
            onSelect={(val) => setValue("companyId", val)}
          />
        </div>
      </form>
    </div>
  );
}
