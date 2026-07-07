"use client";

// Deals module, matching the Lovable design: a table view (default) with a
// toggle to the kanban board, plus a split list+preview when a table row is
// selected. The kanban board reuses the existing drag & drop DealsBoard.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, KanbanSquare, Plus, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import {
  DataTable,
  DataTableColumnsMenu,
  DataTableIconButton,
  DataTablePagination,
  DataTableSearch,
  DataTableShell,
  DataTableToolbar,
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
import { DealsBoard } from "./deals-board";

type Stage = {
  id: string;
  name: string;
  color: string;
  type: string;
  order: number;
};

type DealRow = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stageId: string;
  ownerName: string | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
};

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
  deals: DealRow[];
};

type ColKey = "title" | "value" | "stage" | "company";

const COLUMN_LABELS: { key: ColKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "value", label: "Value" },
  { key: "stage", label: "Stage" },
  { key: "company", label: "Company" },
];

function DealAvatar() {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-surface text-muted-foreground">
      <Handshake className="h-3.5 w-3.5" />
    </div>
  );
}

export function DealsClient({
  pipeline,
  editable,
}: {
  pipeline: Pipeline;
  editable: boolean;
}) {
  const router = useRouter();
  const deals = pipeline.deals;
  const stageName = (id: string) =>
    pipeline.stages.find((s) => s.id === id)?.name ?? "";
  const stageColor = (id: string) =>
    pipeline.stages.find((s) => s.id === id)?.color ?? "#3b82f6";

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<ColKey, boolean>>({
    title: true,
    value: true,
    stage: true,
    company: true,
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) =>
      [d.title, stageName(d.stageId), d.company?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, query, pipeline.stages]);

  const allColumns: (DataTableColumn<DealRow> & { key: ColKey })[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      sortValue: (d) => d.title ?? "",
      mobile: "title",
      cell: (d) => (
        <div className="flex items-center gap-3">
          <DealAvatar />
          <div className="truncate text-sm font-medium">{d.title || "Untitled"}</div>
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sortable: true,
      sortValue: (d) => d.value,
      cell: (d) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {d.value.toLocaleString()}{" "}
          <span className="text-xs">{d.currency}</span>
        </span>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      sortValue: (d) => stageName(d.stageId),
      cell: (d) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: stageColor(d.stageId) }}
          />
          {stageName(d.stageId)}
        </span>
      ),
    },
    {
      key: "company",
      header: "Company",
      sortable: true,
      sortValue: (d) => d.company?.name ?? "",
      cell: (d) => <MutedCell value={d.company?.name} />,
    },
  ];
  const columns = allColumns.filter((c) => visible[c.key]);

  const selected = selectedId ? deals.find((d) => d.id === selectedId) ?? null : null;

  const toolbarRight = (
    <div className="ml-auto flex items-center gap-2">
      <ViewToggle view={view} onView={setView} />
      {view === "table" && (
        <DataTableColumnsMenu
          columns={COLUMN_LABELS}
          visible={visible}
          onChange={(k) =>
            setVisible((v) => ({ ...v, [k as ColKey]: !v[k as ColKey] }))
          }
        />
      )}
      {editable && (
        <DataTableIconButton
          aria-label="New Deal"
          onClick={() => router.push("/deals/new")}
        >
          <Plus className="h-4 w-4" />
        </DataTableIconButton>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 bg-background text-foreground">
      {deals.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            variant="page"
            icon={Handshake}
            title="You don't have any deals yet"
            message="Create your first deal to get started."
            action={
              editable ? (
                <button
                  type="button"
                  onClick={() => router.push("/deals/new")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  New Deal
                </button>
              ) : undefined
            }
          />
        </div>
      ) : selected && view === "table" ? (
        <>
          <EntityListPanel query={query} onQuery={setQuery} placeholder="Search deals">
            {rows.length === 0 ? (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </div>
            ) : (
              rows.map((d) => (
                <EntityListRow
                  key={d.id}
                  active={d.id === selected.id}
                  onClick={() => setSelectedId(d.id)}
                  leading={<DealAvatar />}
                  title={d.title || "Untitled"}
                  subtitle={`${stageName(d.stageId)}${d.company ? " · " + d.company.name : ""}`}
                  right={d.value ? d.value.toLocaleString() : ""}
                />
              ))
            )}
          </EntityListPanel>
          <EntityPreviewShell
            eyebrow="Deal"
            title={selected.title || "Untitled"}
            onOpen={() => router.push(`/deals/${selected.id}`)}
            onClose={() => setSelectedId(null)}
            toolbar={
              <EntityPreviewToolbar
                onEdit={
                  editable
                    ? () => router.push(`/deals/${selected.id}/edit`)
                    : undefined
                }
              />
            }
          >
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
              <FieldCard label="TITLE">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.title || "Untitled"}
                </div>
              </FieldCard>
              <FieldCard label="VALUE">
                <div className="flex h-9 items-center text-sm tabular-nums text-foreground">
                  {selected.value.toLocaleString()}{" "}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {selected.currency}
                  </span>
                </div>
              </FieldCard>
              <FieldCard label="STAGE">
                <div className="flex h-9 items-center gap-1.5 text-sm text-foreground">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stageColor(selected.stageId) }}
                  />
                  {stageName(selected.stageId)}
                </div>
              </FieldCard>
              <FieldCard label="COMPANY">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.company?.name || "—"}
                </div>
              </FieldCard>
              <FieldCard label="CONTACT">
                <div className="flex h-9 items-center text-sm text-foreground">
                  {selected.contact
                    ? `${selected.contact.firstName} ${selected.contact.lastName}`
                    : "—"}
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
      ) : view === "table" ? (
        <DataTableShell>
          <DataTableToolbar>
            <DataTableSearch value={query} onChange={setQuery} placeholder="Search deals" />
            {toolbarRight}
          </DataTableToolbar>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(d) => d.id}
            onRowClick={(d) => setSelectedId(d.id)}
            minWidth={720}
            emptyMessage={`No matches for "${query}".`}
          />
          <DataTablePagination
            total={rows.length}
            pageSize={pageSize}
            onPageSize={setPageSize}
          />
        </DataTableShell>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          <DataTableToolbar>
            <DataTableSearch value={query} onChange={setQuery} placeholder="Search deals" />
            {toolbarRight}
          </DataTableToolbar>
          <div className="min-h-0 flex-1 overflow-auto">
            <DealsBoard
              pipeline={{
                ...pipeline,
                deals: rows,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onView,
}: {
  view: "table" | "kanban";
  onView: (v: "table" | "kanban") => void;
}) {
  return (
    <div className="inline-flex h-10 items-center rounded-xl border border-border/60 bg-surface p-1">
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={view === "table"}
        onClick={() => onView("table")}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
          view === "table" && "bg-muted/50 text-foreground",
        )}
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Kanban view"
        aria-pressed={view === "kanban"}
        onClick={() => onView("kanban")}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
          view === "kanban" && "bg-muted/50 text-foreground",
        )}
      >
        <KanbanSquare className="h-4 w-4" />
      </button>
    </div>
  );
}
