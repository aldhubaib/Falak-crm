"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { createProject } from "@/actions/projects";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  itemCount: number;
};

export function NewProjectClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(
    templates[0] ? [templates[0].id] : [],
  );

  const toggleTemplate = (id: string) =>
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const fd = new FormData();
    fd.set("name", name.trim());
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
    <PageContainer className="mx-auto max-w-5xl space-y-4">
      <Section label="PROJECT NAME" required>
        <Input
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Section>

      <Section label="DESCRIPTION">
        <Textarea
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </Section>

      {templates.length > 0 && (
        <Section
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          label="CHECKLIST TEMPLATES"
        >
          <div className="flex flex-wrap gap-2">
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
        </Section>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={!canSave || pending}>
          Create Project
        </Button>
      </div>
    </PageContainer>
  );
}

function Section({
  icon,
  label,
  required,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/50 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
        {required && <span className="text-destructive">*</span>}
      </div>
      {children}
    </div>
  );
}
