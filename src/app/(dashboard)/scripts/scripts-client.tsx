"use client";

import Link from "next/link";
import { FileText, Layers } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScriptListItem } from "@/modules/script/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  researching: "Researching",
  ready: "Ready to write",
  writing: "Writing",
  review: "In review",
  approved: "Approved",
};

function relativeTime(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ScriptsClient({
  scripts,
  editable,
}: {
  scripts: ScriptListItem[];
  editable: boolean;
}) {
  if (!scripts.length) {
    return (
      <PageContainer>
        <SurfaceCard padding="lg" className="flex flex-col items-center gap-3 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No scripts yet</p>
            <p className="text-sm text-muted-foreground">
              Start one, add your references, and lock the facts before writing.
            </p>
          </div>
          {editable && (
            <Button asChild size="sm" className="mt-2 rounded-full">
              <Link href="/scripts/new">New Script</Link>
            </Button>
          )}
        </SurfaceCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {scripts.map((script) => (
          <Link key={script.id} href={`/scripts/${script.id}`} className="block">
            <SurfaceCard className="h-full transition-colors hover:border-border">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium leading-tight">{script.title}</p>
                <Badge variant="secondary" className="shrink-0">
                  {STATUS_LABEL[script.status] ?? script.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {script.projectName ?? "Project removed"}
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {script.sourceCount} {script.sourceCount === 1 ? "source" : "sources"}
                </span>
                <span>{relativeTime(script.updatedAt)}</span>
              </div>
            </SurfaceCard>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
