"use client";

// Companies table view, matching the Lovable design: searchable/sortable data
// table with filter rules, column toggles, and a split list+preview when a
// row is selected. Fully responsive — cards on mobile, table on desktop.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { COUNTRIES } from "@/components/phone-input";
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
  LinkCell,
  MutedCell,
  type DataTableColumn,
} from "@/components/data-table";
import {
  EntityListPanel,
  EntityListRow,
  EntityPreviewShell,
} from "@/components/entity-split";
import { EntityPreviewToolbar } from "@/components/entity-preview-toolbar";
import { FieldCard } from "@/components/crm/field-card";

export type CompanyRow = {
  id: string;
  name: string;
  nameAr: string | null;
  industry: string | null;
  referral: string | null;
  website: string | null;
  countries: string[];
  logo: string | null;
  createdAt: string;
};

type ColKey = "name" | "nameAr" | "industry" | "website" | "countries" | "created";

const COLUMN_LABELS: { key: ColKey; label: string }[] = [
  { key: "name", label: "Company (EN)" },
  { key: "nameAr", label: "Company (AR)" },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "countries", label: "Countries" },
  { key: "created", label: "Created" },
];

function CompanyAvatar({ logo }: { logo: string | null }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border/60 bg-surface text-muted-foreground">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-cover" />
      ) : (
        <Building2 className="h-3.5 w-3.5" />
      )}
    </div>
  );
}

function countryFlags(codes: string[]): string {
  return codes
    .map((code) => COUNTRIES.find((x) => x.code === code)?.flag ?? "")
    .filter(Boolean)
    .join(" ");
}

export function CompaniesClient({
  companies,
  industries,
  referrals,
  editable,
}: {
  companies: CompanyRow[];
  industries: string[];
  referrals: string[];
  editable: boolean;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [visible, setVisible] = useState<Record<ColKey, boolean>>({
    name: true,
    nameAr: true,
    industry: true,
    website: true,
    countries: true,
    created: true,
  });
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterFields = useMemo<FilterField<CompanyRow>[]>(
    () => [
      { id: "name", label: "Name (EN)", type: "text", get: (c) => c.name },
      { id: "nameAr", label: "Name (AR)", type: "text", get: (c) => c.nameAr },
      { id: "website", label: "Website", type: "text", get: (c) => c.website },
      {
        id: "industry",
        label: "Industry",
        type: "select",
        options: industries.map((name) => ({ id: name, label: name })),
        get: (c) => c.industry,
      },
      {
        id: "referral",
        label: "Referral source",
        type: "select",
        options: referrals.map((name) => ({ id: name, label: name })),
        get: (c) => c.referral,
      },
      {
        id: "countries",
        label: "Countries",
        type: "select",
        options: COUNTRIES.map((c) => ({
          id: c.code,
          label: `${c.flag} ${c.name}`,
        })),
        get: (c) => c.countries,
      },
      { id: "created", label: "Created", type: "date", get: (c) => c.createdAt },
    ],
    [industries, referrals],
  );

  const ruleCount = activeRuleCount(rules, filterFields);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = applyFilters(companies, rules, filterFields);
    if (q) {
      filtered = filtered.filter((c) =>
        [c.name, c.nameAr, c.website, c.industry]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [companies, query, rules, filterFields]);

  const allColumns: (DataTableColumn<CompanyRow> & { key: ColKey })[] = [
    {
      key: "name",
      header: "Company (EN)",
      sortable: true,
      sortValue: (c) => c.name.toLowerCase(),
      mobile: "title",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <CompanyAvatar logo={c.logo} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{c.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: "nameAr",
      header: "Company (AR)",
      sortable: true,
      sortValue: (c) => (c.nameAr ?? "").toLowerCase(),
      mobile: "hide",
      cell: (c) =>
        c.nameAr ? (
          <span className="text-sm" dir="rtl">
            {c.nameAr}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "industry",
      header: "Industry",
      sortable: true,
      sortValue: (c) => (c.industry ?? "").toLowerCase(),
      cell: (c) => <MutedCell value={c.industry} />,
    },
    {
      key: "website",
      header: "Website",
      sortable: true,
      sortValue: (c) => (c.website ?? "").toLowerCase(),
      mobile: "hide",
      cell: (c) => <LinkCell href={c.website} />,
    },
    {
      key: "countries",
      header: "Countries",
      cell: (c) => {
        const flags = countryFlags(c.countries);
        if (!flags) return <span className="text-sm text-muted-foreground">—</span>;
        return <span className="text-base leading-none">{flags}</span>;
      },
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      sortValue: (c) => new Date(c.createdAt),
      mobile: "hide",
      cell: (c) => (
        <span className="text-sm text-muted-foreground">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const columns = allColumns.filter((c) => visible[c.key]);

  const selected = selectedId
    ? companies.find((c) => c.id === selectedId) ?? null
    : null;

  return (
    <div className="flex min-h-0 w-full flex-1 bg-background text-foreground">
      {companies.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            variant="page"
            icon={Building2}
            title="You don't have any companies yet"
            message="Create your first company to get started."
            action={
              editable ? (
                <button
                  type="button"
                  onClick={() => router.push("/companies/new")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  New Company
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
            placeholder="Search companies"
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
                  leading={<CompanyAvatar logo={c.logo} />}
                  title={c.name}
                  subtitle={c.industry || c.website || "—"}
                />
              ))
            )}
          </EntityListPanel>
          <EntityPreviewShell
            eyebrow="Company"
            title={selected.name}
            onOpen={() => router.push(`/companies/${selected.id}`)}
            onClose={() => setSelectedId(null)}
            toolbar={
              <EntityPreviewToolbar
                onEdit={
                  editable
                    ? () => router.push(`/companies/${selected.id}`)
                    : undefined
                }
              />
            }
          >
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
              <FieldCard label="COMPANY (EN)">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.name}
                </div>
              </FieldCard>
              <FieldCard label="COMPANY (AR)">
                <div className="flex h-9 items-center text-sm text-foreground" dir="rtl">
                  {selected.nameAr || "—"}
                </div>
              </FieldCard>
              <FieldCard label="INDUSTRY">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.industry || "—"}
                </div>
              </FieldCard>
              <FieldCard label="WEBSITE">
                <div className="flex h-9 items-center text-sm">
                  {selected.website ? (
                    <a
                      href={selected.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {selected.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </FieldCard>
              <FieldCard label="COUNTRIES">
                <div className="flex h-9 items-center text-base leading-none">
                  {countryFlags(selected.countries) || (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </FieldCard>
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
              placeholder="Search companies"
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
                  aria-label="New Company"
                  onClick={() => router.push("/companies/new")}
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
            minWidth={900}
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
