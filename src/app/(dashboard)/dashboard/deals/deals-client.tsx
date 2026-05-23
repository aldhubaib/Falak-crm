"use client";

import { moveDeal, createProjectFromDeal } from "@/actions/deals";
import { Plus, ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useErrorStore } from "@/lib/error-store";

type Stage = {
  id: string;
  name: string;
  color: string;
  type: string;
  order: number;
};

type Deal = {
  id: string;
  title: string;
  value: unknown;
  currency?: string;
  stageId: string;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  stage: Stage;
  project?: { id: string } | null;
};

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
  deals: Deal[];
} | null;

export function DealsClient({
  pipeline,
}: {
  pipeline: Pipeline;
}) {

  if (!pipeline) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No pipeline configured. Go to Settings → Pipelines to set one up.
        </div>
      </div>
    );
  }

  const dealsByStage = pipeline.stages.map((stage) => ({
    ...stage,
    deals: pipeline.deals.filter((d) => d.stageId === stage.id),
  }));

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Deals</h1>
        <Link href="/dashboard/deals/new">
          <Button size="sm">
            <Plus className="w-3.5 h-3.5" />
            New Deal
          </Button>
        </Link>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6">
        {dealsByStage.map((stage) => (
          <div
            key={stage.id}
            className="min-w-[260px] w-[260px] flex-shrink-0"
          >
            {/* Stage Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-[12px] font-medium text-foreground">
                {stage.name}
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">
                {stage.deals.length}
              </span>
            </div>

            {/* Deal Cards */}
            <div className="space-y-2">
              {stage.deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  stages={pipeline.stages}
                  currentStage={stage}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  stages,
  currentStage,
}: {
  deal: Deal;
  stages: Stage[];
  currentStage: Stage;
}) {
  const nextStage = stages.find((s) => s.order === currentStage.order + 1);
  const isWon = currentStage.type === "WON";
  const isLost = currentStage.type === "LOST";
  const isClosed = isWon || isLost;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <Link
        href={`/dashboard/deals/${deal.id}`}
        className="text-[13px] font-medium text-foreground no-underline hover:text-primary transition-colors block"
      >
        {deal.title}
      </Link>
      <div className="text-[11px] text-muted-foreground">
        {deal.company?.name || "No company"}
      </div>
      <div className="text-[13px] font-semibold text-foreground">
        {Number(deal.value).toLocaleString()} {deal.currency || "KWD"}
      </div>

      {!isClosed && nextStage && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const result = await moveDeal(deal.id, nextStage.id);
          if (!result.ok) useErrorStore.getState().push(result.error);
        }}>
          <button
            type="submit"
            className="w-full h-7 rounded-lg bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            Move to {nextStage.name}
          </button>
        </form>
      )}

      {isWon && !deal.project && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const result = await createProjectFromDeal(deal.id);
          if (!result.ok) useErrorStore.getState().push(result.error);
        }}>
          <button
            type="submit"
            className="w-full h-7 rounded-lg bg-success/15 text-[11px] font-medium text-success hover:bg-success/25 transition-colors flex items-center justify-center gap-1"
          >
            <Rocket className="w-3 h-3" />
            Create Project
          </button>
        </form>
      )}

      {isWon && deal.project && (
        <Link
          href={`/dashboard/projects/${deal.project.id}`}
          className="w-full h-7 rounded-lg bg-primary/15 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors flex items-center justify-center gap-1 no-underline"
        >
          View Project
        </Link>
      )}
    </div>
  );
}

