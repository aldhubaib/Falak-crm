"use client";

// THE roles screen: one matrix showing every role × every task stage (with
// the members holding each role and warnings for risky configurations), where
// clicking a role expands its editor right below the row. No separate list —
// what you see is what you edit.

import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Play,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { SurfaceCard } from "@/components/surface-card";
import { normalizePermissions, type Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { RoleDTO, TaskStageDTO } from "./role-editor";

export type RoleMemberChip = {
  id: string;
  name: string;
  avatar: string | null;
  roleId: string | null;
};

const FLAGS = [
  { id: "create", letter: "C", label: "Create tasks" },
  { id: "modify", letter: "M", label: "Modify tasks" },
  { id: "forward", letter: "F", label: "Move forward" },
  { id: "rollback", letter: "R", label: "Roll back" },
  { id: "delete", letter: "D", label: "Delete tasks" },
  { id: "autoAssign", letter: "A", label: "Auto-Assign on entry" },
] as const;

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function MemberChips({ members }: { members: RoleMemberChip[] }) {
  if (members.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-tiny text-muted-foreground">
        <UserRound className="h-3 w-3" /> nobody
      </span>
    );
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((m) => (
        <span
          key={m.id}
          title={m.name}
          className="inline-flex max-w-28 items-center gap-1 rounded-full bg-muted/50 py-0.5 pl-0.5 pr-2 text-tiny text-muted-foreground"
        >
          {m.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.avatar} alt={m.name} className="size-4 rounded-full object-cover" />
          ) : (
            <span className="grid size-4 place-items-center rounded-full bg-primary/20 text-[8px] font-semibold text-primary">
              {initialsOf(m.name)}
            </span>
          )}
          <span className="truncate">{m.name.split(/\s+/)[0]}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="text-tiny text-muted-foreground">+{extra}</span>
      )}
    </span>
  );
}

export function RolesOverview({
  roles,
  stages,
  members,
  expandedId,
  onToggle,
  onDelete,
  onTest,
  renderEditor,
}: {
  roles: RoleDTO[];
  stages: TaskStageDTO[];
  members: RoleMemberChip[];
  /** Role whose editor is open below its row. */
  expandedId: string | null;
  onToggle: (roleId: string) => void;
  onDelete: (role: RoleDTO) => void;
  onTest: (role: RoleDTO) => void;
  /** Renders the role editor for the expanded row. */
  renderEditor: (role: RoleDTO) => ReactNode;
}) {
  const rows = useMemo(
    () =>
      roles.map((r) => ({
        role: r,
        perms: normalizePermissions(r.permissions) as Permissions,
        members: members.filter((m) => m.roleId === r.id),
      })),
    [roles, members],
  );

  // Configurations worth flagging before they bite on the board.
  const hints = useMemo(() => {
    const out: string[] = [];
    for (const stage of stages) {
      const autoRoles = rows.filter(
        (r) => r.perms.taskPermissions?.stages?.[stage.id]?.autoAssign === true,
      );
      if (autoRoles.length > 1) {
        out.push(
          `${autoRoles.map((r) => `"${r.role.name}"`).join(" and ")} both auto-assign at "${stage.name}" — the member added to the project first wins, the others never get it.`,
        );
      }
      for (const r of autoRoles) {
        if (r.members.length === 0) {
          out.push(
            `"${r.role.name}" auto-assigns at "${stage.name}" but nobody holds this role — tasks entering the stage stay with whoever moved them.`,
          );
        }
      }
    }
    return out;
  }, [rows, stages]);

  const fullAccessRoles = rows.filter((r) => r.perms.projects === "full");

  return (
    <div className="space-y-3">
      {fullAccessRoles.length > 0 && (
        <SurfaceCard padding="sm" className="border-warning/40 bg-warning/5">
          <div className="flex items-start gap-2.5 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {fullAccessRoles.map((r) => r.role.name).join(", ")}
              </span>{" "}
              {fullAccessRoles.length === 1 ? "has" : "have"} Full Projects
              access — stage checkboxes don&apos;t apply, these roles can do
              everything in every stage.
            </div>
          </div>
        </SurfaceCard>
      )}

      {hints.map((h) => (
        <SurfaceCard key={h} padding="sm" className="border-warning/40 bg-warning/5">
          <div className="flex items-start gap-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-muted-foreground">{h}</div>
          </div>
        </SurfaceCard>
      ))}

      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-background/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-normal">Role</th>
                {stages.map((s) => (
                  <th key={s.id} className="px-2 py-2 text-center font-normal">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ role, perms, members: roleMembers }) => {
                const full = perms.projects === "full";
                const expanded = expandedId === role.id;
                return (
                  <RowGroup key={role.id}>
                    <tr
                      onClick={() => onToggle(role.id)}
                      className={cn(
                        "cursor-pointer border-b align-top transition-colors hover:bg-surface/70",
                        expanded
                          ? "border-transparent bg-surface/70"
                          : "border-border/40 last:border-b-0",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 font-medium">
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {role.name}
                        </div>
                        <div className="mt-1 pl-5">
                          <MemberChips members={roleMembers} />
                        </div>
                      </td>
                      {full ? (
                        <td
                          colSpan={stages.length}
                          className="px-2 py-2.5 text-center text-xs text-warning"
                        >
                          Full access — everything, everywhere
                        </td>
                      ) : (
                        stages.map((s) => {
                          const sp = perms.taskPermissions?.stages?.[s.id];
                          const granted = FLAGS.filter(
                            (f) => sp?.[f.id as keyof typeof sp] === true,
                          );
                          return (
                            <td key={s.id} className="px-2 py-2.5 text-center">
                              {granted.length === 0 ? (
                                <span className="text-muted-foreground/50">—</span>
                              ) : (
                                <span className="inline-flex flex-wrap justify-center gap-0.5">
                                  {granted.map((f) => (
                                    <span
                                      key={f.id}
                                      title={f.label}
                                      className={cn(
                                        "grid size-5 place-items-center rounded text-[10px] font-semibold",
                                        f.id === "autoAssign"
                                          ? "bg-primary/20 text-primary"
                                          : "bg-muted/60 text-muted-foreground",
                                      )}
                                    >
                                      {f.letter}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                    {expanded && (
                      <tr className="border-b border-border/40 last:border-b-0">
                        <td colSpan={stages.length + 1} className="bg-surface/40 p-0">
                          <div className="flex items-center justify-end gap-1 px-4 pt-3">
                            <button
                              type="button"
                              onClick={() => onTest(role)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              title="Preview the app as this role"
                            >
                              <Play className="h-3.5 w-3.5" /> Test role
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(role)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                          {renderEditor(role)}
                        </td>
                      </tr>
                    )}
                  </RowGroup>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/40 px-3 py-2 text-tiny text-muted-foreground">
          {FLAGS.map((f, i) => (
            <span key={f.id}>
              {i > 0 && " · "}
              <span className="font-semibold">{f.letter}</span> {f.label}
            </span>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

// <tbody> children must be <tr> or fragments — this keeps each role's pair of
// rows (summary + expanded editor) grouped without an invalid wrapper element.
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
