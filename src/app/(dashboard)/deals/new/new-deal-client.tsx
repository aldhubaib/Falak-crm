"use client";

// New Deal / Edit Deal form, matching the Lovable design: title/value/stage/
// company (and contact) field cards in a two-column grid with the save action
// in the header.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SaveButton } from "@/components/save-button";
import { FieldCard } from "@/components/crm/field-card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createDeal, updateDeal } from "@/actions/deals";

const INPUT_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";
const TRIGGER_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus:ring-0";

export type DealFormInitial = {
  title: string;
  value: number;
  stageId: string;
  companyId: string;
  contactId: string;
};

export function NewDealClient({
  companies,
  contacts,
  pipelineId,
  stages,
  initialCompanyId,
  dealId,
  initial,
}: {
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
  pipelineId: string;
  stages: { id: string; name: string; color: string }[];
  initialCompanyId?: string;
  /** When set, the form edits this deal instead of creating a new one. */
  dealId?: string;
  initial?: DealFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!dealId;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [value, setValue] = useState(
    initial && initial.value ? String(initial.value) : "",
  );
  const [stageId, setStageId] = useState(
    initial?.stageId || stages[0]?.id || "",
  );
  const [companyId, setCompanyId] = useState(
    initial?.companyId ?? initialCompanyId ?? "",
  );
  const [contactId, setContactId] = useState(initial?.contactId ?? "");

  const canSave = !!title.trim() && !!companyId;

  const save = () => {
    if (!canSave || pending) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("value", value || "0");
    if (pipelineId && stageId) {
      fd.set("pipelineId", pipelineId);
      fd.set("stageId", stageId);
    }
    fd.set("companyId", companyId);
    if (contactId) fd.set("contactId", contactId);
    startTransition(async () => {
      const result = dealId
        ? await updateDeal(dealId, fd)
        : await createDeal(fd);
      if (result.ok) router.push(`/deals/${result.data.id}`);
    });
  };

  return (
    <>
      <AppHeader
        title={isEdit ? "Edit Deal" : "New Deal"}
        backHref={isEdit ? `/deals/${dealId}` : "/deals"}
        actions={
          <SaveButton
            onClick={save}
            loading={pending}
            ready={canSave}
            disabled={!canSave}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto w-full max-w-4xl pb-10">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldCard label="TITLE" required>
              <Input
                placeholder="e.g. Website redesign"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className={INPUT_CLS}
              />
            </FieldCard>
            <FieldCard label="VALUE">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={INPUT_CLS}
              />
            </FieldCard>
            <FieldCard label="STAGE">
              <SearchableSelect
                value={stageId}
                onValueChange={setStageId}
                placeholder="Select stage"
                searchPlaceholder="Search stages…"
                className={TRIGGER_CLS}
                options={stages.map((s) => ({
                  value: s.id,
                  label: s.name,
                  node: (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </span>
                  ),
                }))}
              />
            </FieldCard>
            <FieldCard
              label="COMPANY"
              required
              error={
                !companyId && title.trim() ? "Company is required" : undefined
              }
            >
              <SearchableSelect
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Select company"
                searchPlaceholder="Search companies…"
                emptyText={
                  companies.length === 0 ? "No companies yet." : "No results."
                }
                className={TRIGGER_CLS}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
            </FieldCard>
            <FieldCard label="CONTACT">
              <SearchableSelect
                value={contactId}
                onValueChange={setContactId}
                placeholder="No contact"
                searchPlaceholder="Search contacts…"
                emptyText={
                  contacts.length === 0 ? "No contacts yet." : "No results."
                }
                className={TRIGGER_CLS}
                options={contacts.map((c) => ({ value: c.id, label: c.name }))}
              />
            </FieldCard>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
