"use client";

import { useState } from "react";
import { createService, deleteService } from "@/actions/services";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";

type Service = {
  id: string;
  name: string;
  description: string | null;
  pricingType: string;
  unitPrice: unknown;
  unit: string | null;
  active: boolean;
};

export function ServicesClient({ services }: { services: Service[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Services</h1>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="w-3.5 h-3.5" />
          Add Service
        </Button>
      </div>

      {creating && (
        <form
          action={async (formData) => {
            await createService(formData);
            setCreating(false);
          }}
          className="mb-4 rounded-lg border border-border p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Service Name</label>
              <input
                name="name"
                placeholder="e.g. Social Media Management"
                required
                autoFocus
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <FormSelect
              name="pricingType"
              label="Pricing Type"
              value="FIXED"
              options={[
                { value: "FIXED", label: "Fixed Price" },
                { value: "MONTHLY", label: "Monthly" },
                { value: "PER_UNIT", label: "Per Unit" },
                { value: "HOURLY", label: "Hourly" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Price</label>
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Unit</label>
              <input
                name="unit"
                placeholder="e.g. month, piece, hour"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea
              name="description"
              placeholder="What's included..."
              rows={2}
              className="w-full py-1.5 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm">Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {services.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          No services yet. Add your first service to build your catalog.
        </div>
      ) : (
        <div className="space-y-1">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-lg p-3 flex items-center justify-between hover:bg-card transition-colors group"
            >
              <div>
                <h3 className="text-[13px] font-medium text-foreground">
                  {service.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {service.pricingType.toLowerCase().replace("_", " ")} •{" "}
                  {Number(service.unitPrice).toLocaleString()} KWD
                  {service.unit ? ` / ${service.unit}` : ""}
                </p>
              </div>
              <form action={deleteService.bind(null, service.id)}>
                <button
                  type="submit"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
