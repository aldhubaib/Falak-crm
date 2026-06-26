"use client";

import { useState } from "react";
import { createProject } from "@/actions/projects";
import { ComboboxField } from "@/components/ui/combobox-field";
import { RecordOwner } from "@/components/ui/record-owner";
import { ArrowLeft, Save, Loader2, ClipboardCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";

type ChecklistTemplatePick = { id: string; name: string; itemCount: number };

export function NewProjectClient({
  deals,
  currentUserName,
  checklistTemplates,
}: {
  deals: { id: string; title: string }[];
  currentUserName: string;
  checklistTemplates: ChecklistTemplatePick[];
}) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("fixed");
  const [dealId, setDealId] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-8">
        <Link
          href="/projects"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">New Project</h1>
        <Button type="submit" form="project-form" disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <form
        id="project-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setNameError("Project name is required");
            return;
          }
          if (saving) return;
          setSaving(true);
          const formData = new FormData();
          formData.set("name", name);
          if (description) formData.set("description", description);
          formData.set("type", type);
          if (dealId) formData.set("dealId", dealId);
          selectedTemplateIds.forEach((tid) => formData.append("templateIds", tid));
          const result = await createProject(formData);
          if (result.ok) {
            router.push(`/projects/${result.data.id}`);
          } else {
            pushError(result.error);
            setSaving(false);
          }
        }}
        className="space-y-5"
      >
        <RecordOwner ownerName={currentUserName} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-card border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Project Name <span className="text-destructive">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="Project name"
              className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            {nameError && <p className="text-[11px] text-destructive mt-0.5">{nameError}</p>}
          </div>

          <div className="rounded-lg bg-card border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-card border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Project Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-8 bg-transparent border-none text-[13px] text-foreground focus:outline-none"
            >
              <option value="fixed">Fixed</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>

          <ComboboxField
            label="Linked Deal"
          value={dealId}
          options={deals.map((d) => ({ id: d.id, label: d.title }))}
          placeholder="Optional — link to a deal"
          selectById
          onSelect={(val) => setDealId(val)}
        />
        </div>

        {checklistTemplates.length > 0 && (
          <div className="rounded-lg bg-card border border-border px-3 pt-2 pb-2.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <ClipboardCheck className="w-3 h-3" />
              Checklist Templates
            </label>
            <div className="flex flex-wrap gap-2">
              {checklistTemplates.map((t) => {
                const selected = selectedTemplateIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelectedTemplateIds((prev) =>
                        selected ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                      selected
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-muted/50 text-muted-foreground border border-border hover:border-primary/30"
                    }`}
                  >
                    {t.name}
                    <span className="text-[10px] opacity-60">{t.itemCount} items</span>
                    {selected && <X className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
