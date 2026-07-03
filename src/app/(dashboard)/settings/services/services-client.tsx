"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { AddItemInput } from "@/components/add-item-input";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import { createService, updateService, deleteService } from "@/actions/services";

type Service = {
  id: string;
  name: string;
  active: boolean;
  pricingType: string;
  unitPrice: unknown;
};

export function ServicesClient({ services }: { services: Service[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  const add = () => {
    const v = value.trim();
    if (!v) return;
    const fd = new FormData();
    fd.set("name", v);
    startTransition(async () => {
      await createService(fd);
      setValue("");
      router.refresh();
    });
  };

  const toggleActive = (id: string, active: boolean) => {
    const fd = new FormData();
    fd.set("active", String(active));
    startTransition(async () => {
      await updateService(id, fd);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteService(id);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-2xl">
      <SurfaceCard padding="sm">
        <div className="mb-2 flex items-center gap-2 text-hint text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Add a new service
        </div>
        <AddItemInput
          value={value}
          onChange={setValue}
          onAdd={add}
          addLabel="Add service"
          placeholder="Service name (e.g. Video Production)"
        />
      </SurfaceCard>

      <div className="space-y-field-gap">
        {services.map((s) => (
          <SurfaceCard
            key={s.id}
            className="group flex items-center gap-3 transition-colors"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
            <Switch
              checked={s.active}
              onCheckedChange={(v) => toggleActive(s.id, v)}
              aria-label={s.active ? "Disable service" : "Enable service"}
              disabled={pending}
            />
            <IconButton
              aria-label="Delete service"
              className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
              onClick={() => remove(s.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </SurfaceCard>
        ))}
        {services.length === 0 && <EmptyState message="No services yet." />}
      </div>
    </PageContainer>
  );
}
