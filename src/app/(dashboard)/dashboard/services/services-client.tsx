"use client";

import { useState } from "react";
import { createService, deleteService } from "@/actions/services";
import { Plus, Trash2, X } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Services</h1>
        <button
          onClick={() => setShowForm(true)}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Service
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-foreground">New Service</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form
            action={async (formData) => {
              await createService(formData);
              setShowForm(false);
            }}
            className="space-y-3"
          >
            <input
              name="name"
              placeholder="Service name"
              required
              className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              name="description"
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                name="pricingType"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="FIXED">Fixed Price</option>
                <option value="MONTHLY">Monthly</option>
                <option value="PER_UNIT">Per Unit</option>
                <option value="HOURLY">Hourly</option>
              </select>
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                placeholder="Price"
                required
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="unit"
                placeholder="Unit (e.g. month)"
                className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              Create Service
            </button>
          </form>
        </div>
      )}

      {services.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No services yet. Add your first service to build your catalog.
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="text-[13px] font-medium text-foreground">
                  {service.name}
                </h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {service.pricingType.toLowerCase().replace("_", " ")} •{" "}
                  {Number(service.unitPrice).toLocaleString()} SAR
                  {service.unit ? ` / ${service.unit}` : ""}
                </p>
              </div>
              <form action={deleteService.bind(null, service.id)}>
                <button
                  type="submit"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
