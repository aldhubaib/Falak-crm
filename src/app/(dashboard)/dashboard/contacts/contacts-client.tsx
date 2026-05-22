"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";

type Contact = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  mobile: string;
  email: string | null;
  role: string | null;
  country: string;
  company: { id: string; name: string } | null;
};

const columns: Column<Contact>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    getValue: (row) => `${row.firstName} ${row.lastName}`,
    href: (row) => `/dashboard/contacts/${row.id}`,
    render: (row) => (
      <a href={`/dashboard/contacts/${row.id}`} className="text-foreground font-medium hover:text-primary transition-colors no-underline">
        {row.firstName} {row.middleName ? `${row.middleName} ` : ""}{row.lastName}
      </a>
    ),
  },
  {
    key: "company",
    label: "Company",
    sortable: true,
    getValue: (row) => row.company?.name || null,
    render: (row) => <span className="text-muted-foreground">{row.company?.name || "—"}</span>,
  },
  {
    key: "mobile",
    label: "Mobile",
    sortable: true,
    render: (row) => <span className="text-muted-foreground">{row.mobile}</span>,
  },
  {
    key: "country",
    label: "Country",
    sortable: true,
    render: (row) => <span className="text-muted-foreground">{row.country}</span>,
  },
  {
    key: "role",
    label: "Role",
    sortable: true,
    render: (row) => <span className="text-muted-foreground">{row.role || "—"}</span>,
  },
];

export function ContactsClient({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Contacts</h1>
        <Button size="sm" href="/dashboard/contacts/new">
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </Button>
      </div>

      <DataTable
        data={contacts}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Search contacts..."
      />
    </div>
  );
}
