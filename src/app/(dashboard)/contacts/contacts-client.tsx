"use client";

// Contacts table view, matching the Lovable design: searchable/sortable data
// table with filter rules, column toggles, and a split list+preview when a
// row is selected. Cards on mobile, table on desktop.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SlidersHorizontal, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FilterDialog } from "@/components/filter-dialog";
import {
  activeRuleCount,
  applyFilters,
  type FilterField,
  type FilterRule,
} from "@/lib/filter-engine";
import {
  DataTable,
  DataTableColumnsMenu,
  DataTableIconButton,
  DataTablePagination,
  DataTableSearch,
  DataTableShell,
  DataTableToolbar,
  EmailCell,
  MutedCell,
  PhoneCell,
  type DataTableColumn,
} from "@/components/data-table";
import {
  EntityListPanel,
  EntityListRow,
  EntityPreviewShell,
} from "@/components/entity-split";
import { EntityPreviewToolbar } from "@/components/entity-preview-toolbar";
import { FieldCard } from "@/components/crm/field-card";

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
};

type ColKey = "name" | "email" | "phone" | "company";

const COLUMN_LABELS: { key: ColKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
];

function ContactAvatar() {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-surface text-muted-foreground">
      <Users className="h-3.5 w-3.5" />
    </div>
  );
}

export function ContactsClient({
  contacts,
  editable,
}: {
  contacts: ContactRow[];
  editable: boolean;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [visible, setVisible] = useState<Record<ColKey, boolean>>({
    name: true,
    email: true,
    phone: true,
    company: true,
  });
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of contacts) {
      if (c.companyId && c.companyName) seen.set(c.companyId, c.companyName);
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [contacts]);

  const filterFields = useMemo<FilterField<ContactRow>[]>(
    () => [
      { id: "name", label: "Name", type: "text", get: (c) => c.name },
      { id: "email", label: "Email", type: "text", get: (c) => c.email },
      { id: "phone", label: "Phone", type: "text", get: (c) => c.phone },
      {
        id: "company",
        label: "Company",
        type: "select",
        options: companyOptions,
        get: (c) => c.companyId,
      },
      { id: "created", label: "Created", type: "date", get: (c) => c.createdAt },
    ],
    [companyOptions],
  );

  const ruleCount = activeRuleCount(rules, filterFields);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = applyFilters(contacts, rules, filterFields);
    if (q) {
      filtered = filtered.filter((c) =>
        [c.name, c.email, c.phone, c.companyName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [contacts, query, rules, filterFields]);

  const allColumns: (DataTableColumn<ContactRow> & { key: ColKey })[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (c) => c.name,
      mobile: "title",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <ContactAvatar />
          <div className="truncate text-sm font-medium">{c.name}</div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      sortValue: (c) => c.email ?? "",
      cell: (c) => <EmailCell value={c.email} />,
    },
    {
      key: "phone",
      header: "Phone",
      sortable: true,
      sortValue: (c) => c.phone ?? "",
      cell: (c) => <PhoneCell value={c.phone} />,
    },
    {
      key: "company",
      header: "Company",
      sortable: true,
      sortValue: (c) => c.companyName ?? "",
      cell: (c) => <MutedCell value={c.companyName} />,
    },
  ];
  const columns = allColumns.filter((c) => visible[c.key]);

  const selected = selectedId
    ? contacts.find((c) => c.id === selectedId) ?? null
    : null;

  return (
    <div className="flex min-h-0 w-full flex-1 bg-background text-foreground">
      {contacts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            message="No contacts yet. Create your first one to get started."
            action={
              editable ? (
                <button
                  type="button"
                  onClick={() => router.push("/contacts/new")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  New Contact
                </button>
              ) : undefined
            }
          />
        </div>
      ) : selected ? (
        <>
          <EntityListPanel
            query={query}
            onQuery={setQuery}
            placeholder="Search contacts"
          >
            {rows.length === 0 ? (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </div>
            ) : (
              rows.map((c) => (
                <EntityListRow
                  key={c.id}
                  active={c.id === selected.id}
                  onClick={() => setSelectedId(c.id)}
                  leading={<ContactAvatar />}
                  title={c.name}
                  subtitle={c.email || c.phone || c.companyName || "—"}
                />
              ))
            )}
          </EntityListPanel>
          <EntityPreviewShell
            eyebrow="Contact"
            title={selected.name}
            onOpen={() => router.push(`/contacts/${selected.id}`)}
            onClose={() => setSelectedId(null)}
            toolbar={
              <EntityPreviewToolbar
                onEdit={
                  editable
                    ? () => router.push(`/contacts/${selected.id}`)
                    : undefined
                }
                onWhatsapp={
                  selected.phone
                    ? () =>
                        window.open(
                          `https://wa.me/${selected.phone!.replace(/[^\d]/g, "")}`,
                          "_blank",
                        )
                    : undefined
                }
              />
            }
          >
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
              <FieldCard label="NAME">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.name}
                </div>
              </FieldCard>
              <FieldCard label="EMAIL">
                <div className="flex h-9 items-center text-sm">
                  {selected.email ? (
                    <a
                      href={`mailto:${selected.email}`}
                      className="text-primary hover:underline"
                    >
                      {selected.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </FieldCard>
              <FieldCard label="PHONE">
                <div className="flex h-9 items-center text-sm">
                  {selected.phone ? (
                    <a
                      href={`tel:${selected.phone.replace(/[^+\d]/g, "")}`}
                      className="text-primary hover:underline"
                    >
                      {selected.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </FieldCard>
              <FieldCard label="COMPANY">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.companyName || "—"}
                </div>
              </FieldCard>
              {selected.role && (
                <FieldCard label="ROLE">
                  <div className="flex h-9 items-center text-sm text-foreground">
                    {selected.role}
                  </div>
                </FieldCard>
              )}
              <FieldCard label="CREATED">
                <div className="flex h-9 items-center text-sm text-muted-foreground">
                  {new Date(selected.createdAt).toLocaleDateString()}
                </div>
              </FieldCard>
            </div>
          </EntityPreviewShell>
        </>
      ) : (
        <DataTableShell>
          <DataTableToolbar>
            <DataTableSearch
              value={query}
              onChange={setQuery}
              placeholder="Search contacts"
            />
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <DataTableIconButton
                  aria-label="Filter"
                  onClick={() => setFilterOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </DataTableIconButton>
                {ruleCount > 0 && (
                  <span className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
                    {ruleCount}
                  </span>
                )}
              </div>
              <DataTableColumnsMenu
                columns={COLUMN_LABELS}
                visible={visible}
                onChange={(k) =>
                  setVisible((v) => ({ ...v, [k as ColKey]: !v[k as ColKey] }))
                }
              />
              {editable && (
                <DataTableIconButton
                  aria-label="New Contact"
                  onClick={() => router.push("/contacts/new")}
                >
                  <Plus className="h-4 w-4" />
                </DataTableIconButton>
              )}
            </div>
          </DataTableToolbar>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(c) => c.id}
            onRowClick={(c) => setSelectedId(c.id)}
            minWidth={720}
            emptyMessage={`No matches for "${query}".`}
          />
          <DataTablePagination
            total={rows.length}
            pageSize={pageSize}
            onPageSize={setPageSize}
          />
        </DataTableShell>
      )}
      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        fields={filterFields}
        value={rules}
        onChange={setRules}
      />
    </div>
  );
}
