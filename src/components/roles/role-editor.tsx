"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateRole } from "@/actions/team";
import { useErrorStore } from "@/lib/error-store";
import { createAppError } from "@/lib/errors";
import {
  MODULES,
  normalizePermissions,
  type ModuleCaps,
  type ModuleKey,
  type ModulePermission,
  type StagePermission,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type RoleDTO = {
  id: string;
  name: string;
  permissions: unknown;
};

export type TaskStageDTO = {
  id: string;
  name: string;
  order: number;
};

type StageFlag = keyof StagePermission;

const STAGE_PERMISSIONS: { id: StageFlag; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "modify", label: "Modify" },
  { id: "forward", label: "Forward" },
  { id: "rollback", label: "Rollback" },
  { id: "delete", label: "Delete" },
  { id: "autoAssign", label: "Auto-Assign" },
];

export function RoleEditor({
  role,
  stages: taskStages,
  onClose,
}: {
  role: RoleDTO;
  stages: TaskStageDTO[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { push } = useErrorStore();

  const initial = useMemo(() => normalizePermissions(role.permissions), [role]);

  const [name, setName] = useState(role.name);
  const [modules, setModules] = useState<Record<ModuleKey, ModulePermission>>(
    () => {
      const result = {} as Record<ModuleKey, ModulePermission>;
      for (const m of MODULES) result[m.key] = initial[m.key];
      return result;
    },
  );
  const [stages, setStages] = useState<Record<string, Partial<StagePermission>>>(
    () => ({ ...(initial.taskPermissions?.stages ?? {}) }),
  );
  // Fine-grained per-module capabilities (normalization materialized them all).
  const [caps, setCaps] = useState<Partial<Record<ModuleKey, ModuleCaps>>>(() => {
    const result: Partial<Record<ModuleKey, ModuleCaps>> = {};
    for (const m of MODULES) {
      if (m.capabilities?.length) result[m.key] = { ...(initial.caps?.[m.key] ?? {}) };
    }
    return result;
  });
  // Start expanded when any capability differs from what the level implies,
  // so non-default grants are visible at a glance.
  const [openCaps, setOpenCaps] = useState<Set<ModuleKey>>(() => {
    const open = new Set<ModuleKey>();
    for (const m of MODULES) {
      if (!m.capabilities?.length) continue;
      const levelDefault = initial[m.key] === "full";
      if (m.capabilities.some((c) => (initial.caps?.[m.key]?.[c.key] ?? false) !== levelDefault)) {
        open.add(m.key);
      }
    }
    return open;
  });

  const getModule = (id: ModuleKey): ModulePermission => modules[id] ?? "none";
  const setModule = (id: ModuleKey, v: ModulePermission) =>
    setModules((prev) => ({ ...prev, [id]: v }));

  const getCap = (id: ModuleKey, cap: string) => caps[id]?.[cap] ?? false;
  const setCap = (id: ModuleKey, cap: string, v: boolean) =>
    setCaps((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), [cap]: v } }));
  const toggleOpen = (id: ModuleKey) =>
    setOpenCaps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const getStage = (id: string, p: StageFlag) => stages?.[id]?.[p] ?? false;
  const toggleStage = (id: string, p: StageFlag, v: boolean) =>
    setStages((prev) => ({
      ...prev,
      [id]: { ...(prev?.[id] ?? {}), [p]: v },
    }));

  const dirty = useMemo(() => {
    const initialModules = {} as Record<ModuleKey, ModulePermission>;
    for (const m of MODULES) initialModules[m.key] = initial[m.key];
    const initialCaps: Partial<Record<ModuleKey, ModuleCaps>> = {};
    for (const m of MODULES) {
      if (m.capabilities?.length) initialCaps[m.key] = { ...(initial.caps?.[m.key] ?? {}) };
    }
    return (
      name !== role.name ||
      JSON.stringify(modules) !== JSON.stringify(initialModules) ||
      JSON.stringify(stages) !==
        JSON.stringify(initial.taskPermissions?.stages ?? {}) ||
      JSON.stringify(caps) !== JSON.stringify(initialCaps)
    );
  }, [name, modules, stages, caps, role, initial]);

  // First/last stage by order: nothing to roll back to / forward into.
  const firstStageId = taskStages[0]?.id;
  const lastStageId = taskStages[taskStages.length - 1]?.id;

  const save = () => {
    startTransition(async () => {
      const result = await updateRole(role.id, {
        name: name.trim() || role.name,
        permissions: {
          ...modules,
          taskPermissions: { stages },
          caps,
        },
      });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        push(createAppError(new Error(result.error.message), { action: "Update Role" }));
      }
    });
  };

  return (
    <div className="space-y-6 border-t border-border/60 p-4 sm:p-5">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" />

      <section className="space-y-3">
        <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Module Access
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_repeat(3,80px)]">
            <div>Module</div>
            <div className="text-center">None</div>
            <div className="text-center">View</div>
            <div className="text-center">Full</div>
          </div>
          {MODULES.map((m) => {
            const value = getModule(m.key);
            const hasCaps = (m.capabilities?.length ?? 0) > 0;
            const open = openCaps.has(m.key);
            return (
              <div key={m.key} className="border-b border-border/40 last:border-b-0">
                <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_repeat(3,80px)]">
                  {hasCaps ? (
                    <button
                      type="button"
                      onClick={() => toggleOpen(m.key)}
                      className="flex min-w-0 items-center gap-1.5 text-left"
                      aria-expanded={open}
                      aria-label={`${m.label} detailed permissions`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm">{m.label}</span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                              open && "rotate-180",
                            )}
                          />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {m.description}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="min-w-0">
                      <div className="truncate text-sm">{m.label}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.description}
                      </div>
                    </div>
                  )}
                  <RadioGroup
                    value={value}
                    onValueChange={(v) => setModule(m.key, v as ModulePermission)}
                    className="col-span-3 grid grid-cols-3 gap-2"
                  >
                    <div className="flex justify-center">
                      <RadioGroupItem
                        value="none"
                        aria-label="None"
                        className={cn(value === "none" && "border-destructive text-destructive")}
                      />
                    </div>
                    <div className="flex justify-center">
                      <RadioGroupItem
                        value="view"
                        aria-label="View"
                        className={cn(value === "view" && "border-warning text-warning")}
                      />
                    </div>
                    <div className="flex justify-center">
                      <RadioGroupItem value="full" aria-label="Full" />
                    </div>
                  </RadioGroup>
                </div>
                {hasCaps && open && (
                  <div className="space-y-2.5 border-t border-border/30 bg-background/30 px-3 py-2.5 pl-6">
                    {m.capabilities!.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm">{c.label}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {c.description}
                          </div>
                        </div>
                        <Switch
                          checked={getCap(m.key, c.key)}
                          onCheckedChange={(v) => setCap(m.key, c.key, v)}
                          disabled={value === "none"}
                          aria-label={`${m.label}: ${c.label}`}
                        />
                      </div>
                    ))}
                    {value === "none" && (
                      <p className="text-tiny text-muted-foreground">
                        Grant at least View access to enable these options.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-tiny text-muted-foreground">
          None = hidden from sidebar. View = read-only access. Full = can create, edit, and delete.
        </p>
      </section>

      <section className="space-y-3">
        <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Task Stage Permissions
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-background/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-normal">Stage</th>
                {STAGE_PERMISSIONS.map((p) => (
                  <th key={p.id} className="px-2 py-2 text-center font-normal">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taskStages.map((s) => (
                <tr key={s.id} className="border-b border-border/40 last:border-b-0">
                  <td className="px-3 py-2.5">{s.name}</td>
                  {STAGE_PERMISSIONS.map((p) => {
                    const disabled =
                      (p.id === "rollback" && s.id === firstStageId) ||
                      (p.id === "forward" && s.id === lastStageId);
                    return (
                      <td key={p.id} className="px-2 py-2.5 text-center">
                        {disabled ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex justify-center">
                            <Checkbox
                              checked={getStage(s.id, p.id)}
                              onCheckedChange={(v) =>
                                toggleStage(s.id, p.id, v === true)
                              }
                              aria-label={`${s.name} ${p.label}`}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-tiny text-muted-foreground">
          Create = can create tasks in this stage. Modify = can edit tasks in this stage.
          Forward/Rollback = can move tasks to next/previous stage. Delete = can delete tasks in this stage.
          Auto-Assign = task is automatically assigned to this role when it enters this stage.
        </p>
      </section>

      <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          <X className="h-4 w-4" /> Cancel
        </Button>
        <Button onClick={save} disabled={!dirty || pending}>
          <Check className="h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}
