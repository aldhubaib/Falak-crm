"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { SaveButton } from "@/components/save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAction } from "@/hooks/use-action";
import { createScript } from "@/modules/script/actions";
import type { ProjectOption } from "@/modules/script/integration";

export function NewScriptClient({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [minutes, setMinutes] = useState("");

  const { execute, loading } = useAction(createScript);
  const ready = title.trim().length > 0 && projectId.length > 0;

  async function submit() {
    if (!ready) return;
    const parsed = Number(minutes);
    const created = await execute({
      title,
      projectId,
      targetMinutes: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    });
    if (created) router.push(`/scripts/${created.id}`);
  }

  return (
    <PageContainer>
      <SurfaceCard padding="lg" className="max-w-xl space-y-5">
        <div className="space-y-2">
          <Label htmlFor="script-title">Title</Label>
          <Input
            id="script-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Butcher Baker of Alaska"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="script-project">Project</Label>
          <SearchableSelect
            id="script-project"
            value={projectId}
            onValueChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder={projects.length ? "Pick a project" : "No projects yet"}
            searchPlaceholder="Search projects"
            emptyText="No matching project"
            disabled={!projects.length}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="script-minutes">Target length (minutes)</Label>
          <Input
            id="script-minutes"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="12"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Used later to size the draft to your voice-over pace.
          </p>
        </div>

        <SaveButton
          label="Create Script"
          ready={ready}
          loading={loading}
          disabled={!ready}
          onClick={submit}
        />
      </SurfaceCard>
    </PageContainer>
  );
}
