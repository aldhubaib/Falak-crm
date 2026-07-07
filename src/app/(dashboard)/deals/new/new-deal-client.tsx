"use client";

// New Deal form, matching the Lovable design: title/value/stage/company (and
// contact) field cards in a two-column grid with the save action in the
// header.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SaveButton } from "@/components/save-button";
import { FieldCard } from "@/components/crm/field-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeal } from "@/actions/deals";

const INPUT_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";
const TRIGGER_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus:ring-0";

export function NewDealClient({
  companies,
  contacts,
  pipelineId,
  stages,
  initialCompanyId,
}: {
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
  pipelineId: string;
  stages: { id: string; name: string; color: string }[];
  initialCompanyId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [companyId, setCompanyId] = useState(initialCompanyId ?? "");
  const [contactId, setContactId] = useState("");

  const canSave = !!title.trim();

  const save = () => {
    if (!canSave || pending) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("value", value || "0");
    if (pipelineId && stageId) {
      fd.set("pipelineId", pipelineId);
      fd.set("stageId", stageId);
    }
    if (companyId) fd.set("companyId", companyId);
    if (contactId) fd.set("contactId", contactId);
    startTransition(async () => {
      const result = await createDeal(fd);
      if (result.ok) router.push(`/deals/${result.data.id}`);
    });
  };

  return (
    <>
      <AppHeader
        title="New Deal"
        backHref="/deals"
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
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className={TRIGGER_CLS}>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldCard>
            <FieldCard label="COMPANY">
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className={TRIGGER_CLS}>
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {companies.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No companies yet.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </FieldCard>
            <FieldCard label="CONTACT">
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className={TRIGGER_CLS}>
                  <SelectValue placeholder="No contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {contacts.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No contacts yet.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </FieldCard>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
