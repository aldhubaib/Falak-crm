"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { moveDeal } from "@/actions/deals";
import { cn } from "@/lib/utils";

type Deal = {
  id: string;
  title: string;
  value: unknown;
  currency: string;
  stageId: string;
  ownerName: string | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
};

type Stage = {
  id: string;
  name: string;
  color: string;
  type: string;
  order: number;
};

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
  deals: Deal[];
};

export function DealsBoard({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDrop = (dealId: string, stageId: string) => {
    startTransition(async () => {
      await moveDeal(dealId, stageId);
      router.refresh();
    });
  };

  return (
    <div
      className="grid min-h-[calc(100vh-4rem)] gap-4 p-5"
      style={{
        gridTemplateColumns: `repeat(${pipeline.stages.length}, minmax(220px, 1fr))`,
      }}
    >
      {pipeline.stages.map((stage) => {
        const stageDeals = pipeline.deals.filter((d) => d.stageId === stage.id);
        const stageTotal = stageDeals.reduce(
          (sum, d) => sum + Number(d.value ?? 0),
          0,
        );

        return (
          <div key={stage.id} className="flex min-w-0 flex-col">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-foreground">{stage.name}</span>
              <span className="text-muted-foreground">{stageDeals.length}</span>
              {stageTotal > 0 && (
                <span className="ml-auto text-tiny font-medium text-muted-foreground tabular-nums">
                  {stageTotal.toLocaleString()}
                </span>
              )}
            </div>

            <div
              className="flex-1 space-y-2 rounded-lg border border-dotted border-transparent p-1 min-h-24 transition-colors"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                e.currentTarget.classList.add(
                  "border-primary/60",
                  "bg-primary/5",
                );
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                e.currentTarget.classList.remove(
                  "border-primary/60",
                  "bg-primary/5",
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove(
                  "border-primary/60",
                  "bg-primary/5",
                );
                const dealId = e.dataTransfer.getData("text/deal-id");
                if (dealId) handleDrop(dealId, stage.id);
              }}
            >
              {stageDeals.length === 0 ? (
                <div className="grid h-24 place-items-center text-xs text-muted-foreground">
                  No deals
                </div>
              ) : (
                stageDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/deal-id", deal.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="block rounded-xl border border-border/60 bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md cursor-grab active:cursor-grabbing"
                  >
                    <div className="text-sm font-medium text-foreground">
                      {deal.title}
                    </div>
                    {deal.company && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {deal.company.name}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-tiny">
                      <span className="font-semibold tabular-nums text-foreground">
                        {Number(deal.value ?? 0).toLocaleString()}{" "}
                        <span className="text-muted-foreground font-normal">
                          {deal.currency}
                        </span>
                      </span>
                      {deal.ownerName && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-xxs font-medium text-primary">
                          {deal.ownerName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
