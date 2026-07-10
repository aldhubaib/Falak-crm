"use client";

import Link from "next/link";
import { UserCheck } from "lucide-react";
import { SettingsSection } from "@/components/settings-section";
import { ProjectAvatar } from "@/components/project-avatar";
import { TypeIcon } from "@/components/task-types/task-type-visuals";
import type { MyResponsibilityData } from "@/actions/responsibility";

export function MyResponsibilityModule({ data }: { data: MyResponsibilityData }) {
  const { count, slots } = data;
  const visible = slots.slice(0, 4);
  const hidden = count - visible.length;

  return (
    <SettingsSection
      icon={UserCheck}
      title="My responsibility"
      description={
        count === 1
          ? "planned slot to fill this week"
          : "planned slots to fill this week"
      }
      bodyClassName="flex flex-col space-y-0"
      action={
        <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">
          {count}
        </span>
      }
    >
      <div className="h-[320px] space-y-2 overflow-y-auto">
        {count === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            No open plan slots assigned to you
          </div>
        ) : (
          visible.map((slot) => (
            <Link
              key={slot.slotId}
              href={`/projects/${slot.projectId}`}
              className="flex items-center gap-3 rounded-xl border border-dashed border-border/60 bg-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-surface/40"
            >
              <TypeIcon
                name={slot.templateIcon}
                className="h-4 w-4 shrink-0"
                style={{ color: slot.templateColor ?? "#f59e0b" }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {slot.templateName}{" "}
                  <span className="text-muted-foreground/50">#{slot.slotIndex}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ProjectAvatar name={slot.projectName} size={14} />
                  <span className="truncate">{slot.projectName}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      {hidden > 0 && (
        <p className="-mx-5 -mb-5 mt-2 border-t border-border/60 px-5 py-3 text-center text-xs text-muted-foreground">
          +{hidden} more on the board
        </p>
      )}
    </SettingsSection>
  );
}
