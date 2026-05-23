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

      {/* Stage Totals */}
      <div className="flex gap-4 overflow-x-auto -mx-6 px-6 mb-4">
        {dealsByStage.map((stage) => {
          const total = stage.deals.reduce((sum, d) => sum + Number(d.value), 0);
          return (
            <div key={stage.id} className="min-w-[280px] w-[280px] flex-shrink-0">
              <p className="text-[12px] text-muted-foreground px-1">
                {total.toLocaleString()} <span className="text-[10px]">{stage.deals[0]?.currency || "KWD"}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6" style={{ height: "calc(100vh - 200px)" }}>
        {dealsByStage.map((stage) => (
          <div
            key={stage.id}
            className="min-w-[280px] w-[280px] flex-shrink-0 flex flex-col"
          >
            {/* Stage Header */}
            <div className="rounded-t-xl overflow-hidden mb-0">
              <div className="h-1" style={{ backgroundColor: stage.color }} />
              <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-t-0 border-border rounded-b-none">
                <span className="text-[12px] font-semibold text-foreground">
                  {stage.name}
                </span>
                <span
                  className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                >
                  {stage.deals.length}
                </span>
              </div>
            </div>

            {/* Deal Cards */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2 pb-2 px-0.5 scrollbar-thin">
              {stage.deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  stages={pipeline.stages}
                  currentStage={stage}
                />
              ))}
              {stage.deals.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
                  <p className="text-[11px] text-muted-foreground/50">No deals</p>
                </div>
              )}
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
    <div className="rounded-xl border border-border bg-card hover:border-border/80 transition-colors group">
      <Link
        href={`/dashboard/deals/${deal.id}`}
        className="block p-3 no-underline"
      >
        <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors leading-tight mb-1.5">
          {deal.title}
        </p>
        <p className="text-[11px] text-muted-foreground mb-2">
          {deal.company?.name || "No company"}
          {deal.contact && ` • ${deal.contact.firstName} ${deal.contact.lastName}`}
        </p>
        <p className="text-[14px] font-semibold text-foreground">
          {Number(deal.value).toLocaleString()} <span className="text-[11px] font-normal text-muted-foreground">{deal.currency || "KWD"}</span>
        </p>
      </Link>

      {(!isClosed || (isWon && !deal.project)) && (
        <div className="px-3 pb-3 pt-0">
          {!isClosed && nextStage && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              const result = await moveDeal(deal.id, nextStage.id);
              if (!result.ok) useErrorStore.getState().push(result.error);
            }}>
              <button
                type="submit"
                className="w-full h-7 rounded-lg bg-muted/50 border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1"
              >
                <ArrowRight className="w-3 h-3" />
                {nextStage.name}
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
                className="w-full h-7 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] font-medium text-green-400 hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1"
              >
                <Rocket className="w-3 h-3" />
                Create Project
              </button>
            </form>
          )}
        </div>
      )}

      {isWon && deal.project && (
        <div className="px-3 pb-3 pt-0">
          <Link
            href={`/dashboard/projects/${deal.project.id}`}
            className="w-full h-7 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-1 no-underline"
          >
            View Project
          </Link>
        </div>
      )}
    </div>
  );
}

