"use client";

import { useState } from "react";
import { createDeal } from "@/actions/deals";
import { ComboboxField } from "@/components/ui/combobox-field";
import { FormField } from "@/components/ui/form-field";
import { FIELD_REGISTRY, validateFields } from "@/lib/fields";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useErrorStore } from "@/lib/error-store";

type Stage = { id: string; name: string; color: string; type: string; order: number };

export function NewDealClient({
  pipeline,
  companies,
  contacts,
  currency,
}: {
  pipeline: { id: string; stages: Stage[] } | null;
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [values, setValues] = useState<Record<string, string>>({
    title: "",
    value: "",
  });
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const firstOpenStage = pipeline?.stages.find((s) => s.type === "OPEN");

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const { [key]: _, ...rest } = prev; return rest; });
  };

  const validate = () => {
    const fieldsToValidate = [FIELD_REGISTRY.dealTitle];
    const errs = validateFields(fieldsToValidate, values);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  if (!pipeline) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 h-12 mb-8">
          <Link
            href="/dashboard/deals"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground flex-1">New Deal</h1>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No pipeline configured. Go to Settings → Pipelines to set one up first.
        </div>
      </div>
    );
  }

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
          href="/dashboard/deals"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">New Deal</h1>
        <Button type="submit" form="deal-form">
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>
      </div>

      <form
        id="deal-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validate()) return;
          const formData = new FormData();
          formData.set("title", values.title);
          formData.set("value", values.value || "0");
          formData.set("pipelineId", pipeline.id);
          formData.set("stageId", firstOpenStage?.id ?? "");
          if (companyId) formData.set("companyId", companyId);
          if (contactId) formData.set("contactId", contactId);
          const result = await createDeal(formData);
          if (result.ok) {
            router.push(`/dashboard/deals/${result.data.id}`);
          } else {
            pushError(result.error);
          }
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField def={FIELD_REGISTRY.dealTitle} value={values.title} error={errors.title} onChange={(v) => setValue("title", v)} />
          <FormField def={FIELD_REGISTRY.dealValue} value={values.value} error={errors.value} onChange={(v) => setValue("value", v)} suffix={currency} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(errors.companyId && "shake")}>
            <ComboboxField
              label="Company"
              value={companyId}
              options={companies.map((c) => ({ id: c.id, label: c.name }))}
              placeholder="Select company..."
              selectById
              onSelect={(val) => setCompanyId(val)}
            />
          </div>
          <div className={cn(errors.contactId && "shake")}>
            <ComboboxField
              label="Contact"
              value={contactId}
              options={contacts.map((c) => ({ id: c.id, label: c.name }))}
              placeholder="Select contact..."
              selectById
              onSelect={(val) => setContactId(val)}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
