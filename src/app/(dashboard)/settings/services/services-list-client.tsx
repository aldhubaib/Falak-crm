"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

type Service = {
  id: string;
  name: string;
  description: string | null;
  pricingType: string;
  unitPrice: unknown;
  unit: string | null;
  active: boolean;
};

const PRICING_LABELS: Record<string, string> = {
  FIXED: "Fixed Price",
  MONTHLY: "Monthly",
  PER_UNIT: "Per Unit",
  HOURLY: "Hourly",
};

const columns = [
  {
    key: "name" as const,
    label: "Name",
    sortable: true,
  },
  {
    key: "pricingType" as const,
    label: "Pricing Type",
    sortable: true,
    render: (row: Service) => PRICING_LABELS[row.pricingType] || row.pricingType,
  },
  {
    key: "unitPrice" as const,
    label: "Price",
    sortable: true,
    render: (row: Service) =>
      `${Number(row.unitPrice).toLocaleString()} KWD${row.unit ? ` / ${row.unit}` : ""}`,
  },
  {
    key: "active" as const,
    label: "Status",
    render: (row: Service) => (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
          row.active
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            row.active ? "bg-emerald-400" : "bg-muted-foreground"
          }`}
        />
        {row.active ? "Active" : "Inactive"}
      </span>
    ),
  },
];

export function ServicesListClient({ services }: { services: Service[] }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Services</h1>
        </div>
        <Link href="/settings/services/new">
          <Button size="sm">
            <Plus className="w-3.5 h-3.5" />
            Add Service
          </Button>
        </Link>
      </div>

      <DataTable
        data={services}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Search services..."
        rowHref={(row) => `/settings/services/${row.id}`}
      />
    </div>
  );
}
