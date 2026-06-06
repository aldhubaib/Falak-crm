"use client";

import { updateService, deleteService } from "@/actions/services";
import { InputField, SelectField } from "@/components/ui/field";
import { ArrowLeft, Layers, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";

type Service = {
  id: string;
  name: string;
  description: string | null;
  pricingType: string;
  unitPrice: unknown;
  unit: string | null;
  active: boolean;
};

const PRICING_OPTIONS = [
  { value: "FIXED", label: "Fixed Price" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "PER_UNIT", label: "Per Unit" },
  { value: "HOURLY", label: "Hourly" },
];

export function ServiceDetailClient({ service }: { service: Service }) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();

  const save = (field: string) => async (value: string) => {
    const formData = new FormData();
    formData.set(field, value);
    const result = await updateService(service.id, formData);
    if (!result.ok) pushError(result.error);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings/services"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">{service.name}</h1>
        </div>
        <button
          onClick={async () => {
            if (!confirm(`Delete "${service.name}"?`)) return;
            await deleteService(service.id);
            router.push("/dashboard/settings/services");
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Service Name"
            icon={<Layers className="w-3 h-3" />}
            value={service.name}
            onSave={save("name")}
          />
          <SelectField
            label="Pricing Type"
            value={service.pricingType}
            options={PRICING_OPTIONS}
            onSave={save("pricingType")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Price"
            value={String(Number(service.unitPrice))}
            placeholder="0.00"
            onSave={save("unitPrice")}
          />
          <InputField
            label="Unit"
            value={service.unit || ""}
            placeholder="e.g. month, piece, hour"
            onSave={save("unit")}
          />
        </div>
        <InputField
          label="Description"
          value={service.description || ""}
          placeholder="What's included..."
          onSave={save("description")}
        />
        <SelectField
          label="Status"
          value={service.active ? "true" : "false"}
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
          onSave={async (val) => {
            const formData = new FormData();
            formData.set("active", val);
            const result = await updateService(service.id, formData);
            if (!result.ok) pushError(result.error);
          }}
        />
      </div>
    </div>
  );
}
