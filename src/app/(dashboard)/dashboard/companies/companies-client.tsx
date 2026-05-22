"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  nameAr: string | null;
  industry: string | null;
  referral: string | null;
  address: string | null;
  _count: { contacts: number; deals: number; projects: number };
};

const columns: Column<Company>[] = [
  {
    key: "name",
    label: "Company",
    sortable: true,
    href: (row) => `/dashboard/companies/${row.id}`,
  },
  {
    key: "industry",
    label: "Industry",
    sortable: true,
    render: (row) => <span className="text-muted-foreground">{row.industry || "—"}</span>,
  },
  {
    key: "address",
    label: "Country",
    sortable: true,
    render: (row) => <span className="text-muted-foreground">{row.address || "—"}</span>,
  },
  {
    key: "referral",
    label: "Referral",
    sortable: true,
    render: (row) => <span className="text-muted-foreground">{row.referral || "—"}</span>,
  },
  {
    key: "contacts",
    label: "Contacts",
    sortable: true,
    align: "center",
    getValue: (row) => row._count.contacts,
    render: (row) => <span className="text-muted-foreground">{row._count.contacts}</span>,
  },
  {
    key: "deals",
    label: "Deals",
    sortable: true,
    align: "center",
    getValue: (row) => row._count.deals,
    render: (row) => <span className="text-muted-foreground">{row._count.deals}</span>,
  },
];

export function CompaniesClient({ companies }: { companies: Company[] }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Companies</h1>
        <Button href="/dashboard/companies/new" size="sm">
          <Plus className="w-3.5 h-3.5" />
          Add Company
        </Button>
      </div>

      <DataTable
        data={companies}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Search companies..."
      />
    </div>
  );
}
