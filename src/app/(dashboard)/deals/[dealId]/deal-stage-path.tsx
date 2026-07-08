"use client";

// Zoho-style chevron stage path for a deal: one arrow segment per pipeline
// stage, with reached stages tinted and the current stage highlighted.
// Clicking a stage moves the deal there (when the user can edit the pipeline).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { moveDeal } from "@/actions/deals";
import { useActionHandler } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; order: number };

const NOTCH = 12;

function clipFor(index: number, count: number) {
  const first = index === 0;
  const last = index === count - 1;
  if (first && last) return undefined;
  if (first)
    return `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`;
  if (last)
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${NOTCH}px 50%)`;
  return `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%, ${NOTCH}px 50%)`;
}

export function DealStagePath({
  dealId,
  stages,
  currentStageId,
  currentOrder,
  editable,
}: {
  dealId: string;
  stages: Stage[];
  currentStageId: string | null;
  currentOrder: number;
  editable: boolean;
}) {
  const router = useRouter();
  const { run } = useActionHandler();
  const [busyId, setBusyId] = useState<string | null>(null);

  const move = async (stage: Stage) => {
    if (!editable || busyId || stage.id === currentStageId) return;
    setBusyId(stage.id);
    await run("Move Deal", async () => {
      const res = await moveDeal(dealId, stage.id);
      if (!res.ok) throw new Error(res.error.message);
      router.refresh();
    });
    setBusyId(null);
  };

  return (
    <div className="flex w-full items-stretch gap-[3px]">
      {stages.map((s, i) => {
        const reached = s.order <= currentOrder;
        const current = s.id === currentStageId;
        return (
          <button
            key={s.id}
            type="button"
            disabled={!editable || busyId !== null}
            onClick={() => move(s)}
            title={s.name}
            style={{ clipPath: clipFor(i, stages.length) }}
            className={cn(
              "grid h-9 min-w-0 flex-1 place-items-center px-4 text-xs font-medium transition-colors",
              current
                ? "bg-primary text-primary-foreground"
                : reached
                  ? "bg-primary/25 text-foreground"
                  : "bg-muted/40 text-muted-foreground",
              editable && !current
                ? "cursor-pointer hover:bg-primary/40 hover:text-foreground"
                : "cursor-default",
            )}
          >
            {busyId === s.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="block w-full truncate text-center">{s.name}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
