"use client";

import { useState, useMemo } from "react";
import { inviteMember, removeMember, createRole, updateRole, deleteRole, startTestRole, stopTestRole } from "@/actions/team";
import { seedDefaultRoles } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { useErrorStore } from "@/lib/error-store";
import { useRouter } from "next/navigation";
import { UserPlus, X, Shield, Plus, Pencil, Trash2, Check, Play, Square } from "lucide-react";
import type { TaskPermissions, StagePermission, ModulePermission, Permissions } from "@/lib/permissions";

type TaskStatus = { id: string; name: string; color: string; order: number };

type Role = {
  id: string;
  name: string;
  permissions: unknown;
};

type Member = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  type: string;
  roleId: string | null;
  role: Role | null;
  joinedAt: Date;
};

function getTaskPermissions(role: Role): TaskPermissions {
  const perms = role.permissions as Record<string, unknown> | null;
  if (perms?.taskPermissions) return perms.taskPermissions as TaskPermissions;
  return { stages: {} };
}

function getStagePermission(tp: TaskPermissions, stageId: string): StagePermission {
  return tp.stages[stageId] || { create: false, modify: false, forward: false, rollback: false, delete: false, autoAssign: false };
}

export function TeamClient({
  members,
  roles,
  taskStatuses,
  testingRoleId,
}: {
  members: Member[];
  roles: Role[];
  taskStatuses: TaskStatus[];
  testingRoleId: string | null;
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const sortedStatuses = useMemo(() => [...taskStatuses].sort((a, b) => a.order - b.order), [taskStatuses]);
  const testingRole = testingRoleId ? roles.find((r) => r.id === testingRoleId) : null;

  return (
    <div className="space-y-6">
      {/* Test Mode Banner */}
      {testingRole && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/30">
          <Play className="w-icon-md h-icon-md text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body text-amber-400 font-medium">
              Testing role: <span className="text-foreground">{testingRole.name}</span>
            </p>
            <p className="text-sub text-amber-400/60">You are seeing the app as this role would. Navigate around to test permissions.</p>
          </div>
          <button
            onClick={async () => {
              await stopTestRole();
              router.refresh();
            }}
            className="flex items-center gap-1.5 text-sub font-medium text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Square className="w-icon-sm h-icon-sm" />
            Stop Testing
          </button>
        </div>
      )}
      {/* Members */}
      <div className="rounded-xl border border-border bg-card p-4 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-body font-medium text-foreground">Members ({members.length})</h3>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="w-icon-sm h-icon-sm" /> Invite
          </Button>
        </div>
        <p className="text-label text-muted-foreground/70 mb-4">
          Roles are assigned per project. Open a project&apos;s Team tab to give a member a role there.
        </p>

        {showInvite && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const result = await inviteMember(formData);
              if (!result.ok) { useErrorStore.getState().push(result.error); return; }
              setShowInvite(false);
            }}
            className="mb-4 p-3 rounded-lg bg-muted/50 space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
                <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">Email <span className="text-destructive">*</span></label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="member@company.com"
                  className="w-full h-input bg-transparent border-none text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>
              <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
                <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">Name</label>
                <input
                  name="name"
                  placeholder="Full name"
                  className="w-full h-input bg-transparent border-none text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormSelect
                name="type"
                label="Type"
                value="MEMBER"
                options={[
                  { value: "MEMBER", label: "Member" },
                  { value: "FREELANCER", label: "Freelancer" },
                ]}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm"><UserPlus className="w-icon-sm h-icon-sm" /> Invite</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 group">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sub font-semibold text-primary shrink-0">
                {(member.name || member.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body text-foreground truncate">{member.name || member.email}</p>
                <p className="text-sub text-muted-foreground">{member.email}</p>
              </div>

              {member.type === "OWNER" ? (
                <span className="px-1.5 py-0.5 rounded text-label font-medium bg-primary/15 text-primary">
                  owner
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-label font-medium bg-muted text-muted-foreground capitalize">
                    {member.type.toLowerCase()}
                  </span>
                  <form action={async () => {
                    const result = await removeMember(member.id);
                    if (!result.ok) useErrorStore.getState().push(result.error);
                  }}>
                    <button type="submit" className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity">
                      <X className="w-icon-sm h-icon-sm" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-icon-md h-icon-md text-primary" />
            <h3 className="text-body font-medium text-foreground">Roles</h3>
          </div>
          <div className="flex items-center gap-2">
            {roles.length === 0 && (
              <form action={seedDefaultRoles}>
                <Button type="submit" size="sm" variant="ghost">
                  <Plus className="w-icon-sm h-icon-sm" /> Create Defaults
                </Button>
              </form>
            )}
            <Button
              size="sm"
              onClick={async () => {
                const result = await createRole("New Role");
                if (result.ok) setEditingRoleId(result.data);
                else useErrorStore.getState().push(result.error);
              }}
            >
              <Plus className="w-icon-sm h-icon-sm" /> New Role
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {roles.map((role) => {
            const memberCount = members.filter((m) => m.roleId === role.id).length;
            const isEditing = editingRoleId === role.id;

            return (
              <div key={role.id}>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Shield className="w-icon-sm h-icon-sm text-muted-foreground shrink-0" />
                    <span className="text-body font-medium text-foreground truncate">{role.name}</span>
                    <span className="text-label text-muted-foreground shrink-0">👥 {memberCount}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {testingRoleId === role.id ? (
                      <button
                        onClick={async () => {
                          await stopTestRole();
                          router.refresh();
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sub font-medium text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
                      >
                        <Square className="w-icon-sm h-icon-sm" />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const result = await startTestRole(role.id);
                          if (result.ok) router.refresh();
                          else useErrorStore.getState().push(result.error);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sub font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title={`Test as ${role.name}`}
                      >
                        <Play className="w-icon-sm h-icon-sm" />
                        Test
                      </button>
                    )}
                    <button
                      onClick={() => setEditingRoleId(isEditing ? null : role.id)}
                      className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                    >
                      <Pencil className="w-icon-sm h-icon-sm" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete role "${role.name}"? Members will be unassigned.`)) return;
                        const result = await deleteRole(role.id);
                        if (!result.ok) useErrorStore.getState().push(result.error);
                      }}
                      className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-icon-sm h-icon-sm" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <RoleEditor
                    role={role}
                    taskStatuses={sortedStatuses}
                    onClose={() => setEditingRoleId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RoleEditor({
  role,
  taskStatuses,
  onClose,
}: {
  role: Role;
  taskStatuses: TaskStatus[];
  onClose: () => void;
}) {
  const router = useRouter();
  const perms = (role.permissions as Record<string, unknown>) || {};
  const tp = getTaskPermissions(role);

  const [name, setName] = useState(role.name);

  const MODULE_DEFS: { key: keyof Omit<Permissions, "taskPermissions">; label: string; description: string }[] = [
    { key: "deals", label: "CRM / Deals", description: "Manage deals and pipeline" },
    { key: "pipeline", label: "Pipeline", description: "View and manage deal pipeline" },
    { key: "projects", label: "Projects", description: "Access project boards and tasks" },
    { key: "invoices", label: "Invoices", description: "View and manage invoices" },
    { key: "publish", label: "Publish", description: "Schedule and publish delivery items" },
    { key: "settings", label: "Settings", description: "Access workspace settings" },
    { key: "team", label: "Team", description: "Manage team members and roles" },
  ];

  const [modules, setModules] = useState<Record<string, ModulePermission>>(() => {
    const map: Record<string, ModulePermission> = {};
    for (const m of MODULE_DEFS) {
      map[m.key] = (perms[m.key] as ModulePermission) || "none";
    }
    return map;
  });

  const [stages, setStages] = useState<Record<string, StagePermission>>(() => {
    const map: Record<string, StagePermission> = {};
    for (const s of taskStatuses) {
      map[s.id] = getStagePermission(tp, s.id);
    }
    return map;
  });
  const [saving, setSaving] = useState(false);


  const toggleStage = (stageId: string, key: keyof StagePermission) => {
    setStages((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], [key]: !prev[stageId][key] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const newPerms = {
      ...modules,
      taskPermissions: { stages },
    };
    if (name !== role.name) {
      await updateRole(role.id, { name, permissions: newPerms });
    } else {
      await updateRole(role.id, { permissions: newPerms });
    }
    setSaving(false);
    router.refresh();
    onClose();
  };

  const firstIdx = 0;
  const lastIdx = taskStatuses.length - 1;

  return (
    <div className="mt-1 rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Role name */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-body font-medium text-foreground bg-black border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-ring transition-colors"
      />

      {/* Module Access */}
      <div>
        <h4 className="text-sub font-medium text-muted-foreground uppercase tracking-wider mb-3">Module Access</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sub font-medium text-muted-foreground px-4 py-2.5">Module</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[80px]">None</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[80px]">View</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[80px]">Full</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_DEFS.map((mod) => (
                <tr key={mod.key} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-body text-foreground">{mod.label}</p>
                    <p className="text-label text-muted-foreground/60">{mod.description}</p>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <ModuleRadio checked={modules[mod.key] === "none"} onChange={() => setModules((p) => ({ ...p, [mod.key]: "none" }))} variant="none" />
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <ModuleRadio checked={modules[mod.key] === "view"} onChange={() => setModules((p) => ({ ...p, [mod.key]: "view" }))} variant="view" />
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <ModuleRadio checked={modules[mod.key] === "full"} onChange={() => setModules((p) => ({ ...p, [mod.key]: "full" }))} variant="full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-label text-muted-foreground/50 mt-2">
          None = hidden from sidebar. View = read-only access. Full = can create, edit, and delete.
        </p>
      </div>

      {/* Stage permissions table */}
      <div>
        <h4 className="text-sub font-medium text-muted-foreground uppercase tracking-wider mb-3">Task Stage Permissions</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sub font-medium text-muted-foreground px-4 py-2.5">Stage</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Create</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Modify</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Forward</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Rollback</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Delete</th>
                <th className="text-center text-sub font-medium text-muted-foreground px-3 py-2.5 w-[80px]">Auto-Assign</th>
              </tr>
            </thead>
            <tbody>
              {taskStatuses.map((status, idx) => {
                const sp = stages[status.id] || { create: false, modify: false, forward: false, rollback: false, delete: false };
                const isFirst = idx === firstIdx;
                const isLast = idx === lastIdx;

                return (
                  <tr key={status.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-body text-foreground">{status.name}</td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.create} onChange={() => toggleStage(status.id, "create")} />
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.modify} onChange={() => toggleStage(status.id, "modify")} />
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {isLast ? (
                        <span className="text-sub text-muted-foreground/30">—</span>
                      ) : (
                        <StageCheckbox checked={sp.forward} onChange={() => toggleStage(status.id, "forward")} />
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {isFirst ? (
                        <span className="text-sub text-muted-foreground/30">—</span>
                      ) : (
                        <StageCheckbox checked={sp.rollback} onChange={() => toggleStage(status.id, "rollback")} />
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.delete} onChange={() => toggleStage(status.id, "delete")} />
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.autoAssign ?? false} onChange={() => toggleStage(status.id, "autoAssign")} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-label text-muted-foreground/50 mt-2">
          Create = can create tasks in this stage. Modify = can edit tasks in this stage. Forward/Rollback = can move tasks to next/previous stage. Delete = can delete tasks in this stage. Auto-Assign = task is automatically assigned to this role when it enters this stage.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground px-4 py-2 transition-colors"
        >
          <X className="w-icon-sm h-icon-sm" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 text-body font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-40 px-5 py-2.5 rounded-xl transition-colors"
        >
          <Check className="w-icon-sm h-icon-sm" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function StageCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded border inline-flex items-center justify-center transition-colors mx-auto ${
        checked
          ? "bg-primary/20 border-primary/50 text-primary"
          : "border-border hover:border-muted-foreground"
      }`}
    >
      {checked && <Check className="w-icon-sm h-icon-sm" />}
    </button>
  );
}

function ModuleRadio({ checked, onChange, variant }: { checked: boolean; onChange: () => void; variant: "none" | "view" | "full" }) {
  const colors = {
    none: checked ? "bg-red-500/15 border-red-500/40 text-red-400" : "border-border hover:border-muted-foreground",
    view: checked ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "border-border hover:border-muted-foreground",
    full: checked ? "bg-green-500/15 border-green-500/40 text-green-400" : "border-border hover:border-muted-foreground",
  };

  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded-full border inline-flex items-center justify-center transition-colors mx-auto ${colors[variant]}`}
    >
      {checked && <div className={`w-2.5 h-2.5 rounded-full ${variant === "none" ? "bg-red-400" : variant === "view" ? "bg-amber-400" : "bg-green-400"}`} />}
    </button>
  );
}
