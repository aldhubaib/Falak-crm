"use client";

import { useState } from "react";
import { createService } from "@/actions/services";
import { FormField } from "@/components/ui/form-field";
import { RecordOwner } from "@/components/ui/record-owner";
import { FIELD_REGISTRY, validateFields, type FieldDef } from "@/lib/fields";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useErrorStore } from "@/lib/error-store";

const PRICING_OPTIONS = [
  { value: "FIXED", label: "Fixed Price" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "PER_UNIT", label: "Per Unit" },
  { value: "HOURLY", label: "Hourly" },
];

const FORM_FIELDS: FieldDef[] = [
  FIELD_REGISTRY.serviceName,
  FIELD_REGISTRY.servicePrice,
];

export function NewServiceClient({ currentUserName }: { currentUserName: string }) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [values, setValues] = useState<Record<string, string>>({
    name: "",
    unitPrice: "",
    unit: "",
    description: "",
    pricingType: "FIXED",
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
          href="/dashboard/settings/services"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">New Service</h1>
        <Button type="submit" form="service-form">
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>
      </div>

      <form
        id="service-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validate()) return;
          const formData = new FormData();
          formData.set("name", values.name);
          formData.set("pricingType", values.pricingType);
          formData.set("unitPrice", values.unitPrice);
          if (values.unit) formData.set("unit", values.unit);
          if (values.description) formData.set("description", values.description);
          const result = await createService(formData);
          if (result.ok) {
            router.push(`/dashboard/settings/services/${result.data.id}`);
          } else {
            pushError(result.error);
          }
        }}
        className="space-y-5"
      >
        <RecordOwner ownerName={currentUserName} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            def={FIELD_REGISTRY.serviceName}
            value={values.name}
            error={errors.name}
            onChange={(v) => setValue("name", v)}
          />
          <div className={cn(errors.pricingType && "shake")}>
            <FormSelect
              name="pricingType"
              label="Pricing Type"
              required
              value={values.pricingType}
              options={PRICING_OPTIONS}
              onChange={(v) => setValue("pricingType", v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            def={FIELD_REGISTRY.servicePrice}
            value={values.unitPrice}
            error={errors.unitPrice}
            onChange={(v) => setValue("unitPrice", v)}
          />
          <FormField
            def={FIELD_REGISTRY.serviceUnit}
            value={values.unit}
            error={errors.unit}
            onChange={(v) => setValue("unit", v)}
          />
        </div>

        <FormField
          def={FIELD_REGISTRY.serviceDescription}
          value={values.description}
          error={errors.description}
          onChange={(v) => setValue("description", v)}
        />
      </form>
    </div>
  );
}
