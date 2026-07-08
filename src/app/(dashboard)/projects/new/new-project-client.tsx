"use client";

// New Project form, matching the standardized CRM create pages (contacts,
// companies, deals): FieldCards in a two-column grid with the save action in
// the header.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Handshake } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SaveButton } from "@/components/save-button";
import { FieldCard } from "@/components/crm/field-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { createProject } from "@/actions/projects";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";
const TRIGGER_CLS =
  "h-9 border-0 bg-transparent px-0 shadow-none focus:ring-0";

type Template = {
  id: string;
  name: string;
  itemCount: number;
};

type DealOption = {
  id: string;
  title: string;
  companyName: string | null;
  stageName: string;
};

export function NewProjectClient({
  templates,
  deals,
}: {
  templates: Template[];
  deals: DealOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [dealId, setDealId] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(
    templates[0] ? [templates[0].id] : [],
  );

  const toggleTemplate = (id: string) =>
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const dealOptions: SearchableOption[] = deals.map((d) => ({
    value: d.id,
    label: d.companyName ? `${d.title} — ${d.companyName}` : d.title,
    keywords: [d.companyName ?? "", d.stageName],
  }));

  const pickDeal = (id: string) => {
    setDealId(id);
    // Convenience: an untouched name inherits the deal title.
    if (!name.trim()) {
      const deal = deals.find((d) => d.id === id);
      if (deal) setName(deal.title);
    }
  };

  const canSave = name.trim().length > 0 && dealId.length > 0;

  const save = () => {
    if (!canSave || pending) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("dealId", dealId);
    fd.set("description", description.trim());
    for (const tid of selectedTemplates) {
      fd.append("templateIds", tid);
    }
    startTransition(async () => {
      const result = await createProject(fd);
      if (result.ok) {
        router.push(`/projects/${result.data.id}`);
      }
    });
  };

  return (
    <>
      <AppHeader
        title="New Project"
        backHref="/projects"
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
            <FieldCard
              label="DEAL"
              icon={<Handshake className="h-3.5 w-3.5" />}
              required
            >
              <SearchableSelect
                value={dealId}
                onValueChange={pickDeal}
                options={dealOptions}
                placeholder="Select a deal…"
                searchPlaceholder="Search deals…"
                emptyText={
                  deals.length === 0
                    ? "No open deals — every project must be linked to a deal."
                    : "No matching deals."
                }
                className={TRIGGER_CLS}
                aria-label="Deal"
              />
            </FieldCard>

            <FieldCard label="PROJECT NAME" required>
              <Input
                placeholder="e.g. Brand campaign"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className={INPUT_CLS}
              />
            </FieldCard>

            <FieldCard label="DESCRIPTION">
              <Textarea
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="min-h-0 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </FieldCard>

            {templates.length > 0 && (
              <FieldCard
                label="CHECKLIST TEMPLATES"
                icon={<ClipboardList className="h-3.5 w-3.5" />}
              >
                <div className="flex flex-wrap gap-2 pt-1">
                  {templates.map((t) => {
                    const on = selectedTemplates.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTemplate(t.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          on
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t.name}
                        <span className="text-muted-foreground">
                          {t.itemCount} items
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FieldCard>
            )}
          </div>
        </PageContainer>
      </main>
    </>
  );
}
