"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderKanban, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/surface-card";
import { createProjectFromDeal } from "@/actions/deals";

export function DealActions({
  dealId,
  stageType,
  hasProject,
  projectId,
}: {
  dealId: string;
  stageType: string;
  hasProject: boolean;
  projectId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleCreateProject = () => {
    startTransition(async () => {
      const result = await createProjectFromDeal(dealId);
      if (result.ok) router.push(`/projects/${result.data.projectId}`);
    });
  };

  if (hasProject && projectId) {
    return (
      <SurfaceCard className="flex items-center gap-3">
        <FolderKanban className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="text-sm font-medium">Project created</div>
          <div className="text-xs text-muted-foreground">
            A project has been created from this deal.
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${projectId}`}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open Project
          </Link>
        </Button>
      </SurfaceCard>
    );
  }

  if (stageType === "WON") {
    return (
      <SurfaceCard className="flex items-center gap-3">
        <FolderKanban className="h-5 w-5 text-success" />
        <div className="flex-1">
          <div className="text-sm font-medium">Deal Won</div>
          <div className="text-xs text-muted-foreground">
            Create a project to start delivering.
          </div>
        </div>
        <Button size="sm" onClick={handleCreateProject} disabled={pending}>
          <FolderKanban className="h-3.5 w-3.5" />
          Create Project
        </Button>
      </SurfaceCard>
    );
  }

  return null;
}
