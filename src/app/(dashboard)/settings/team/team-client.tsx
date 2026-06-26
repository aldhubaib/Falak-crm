"use client";

import { useState } from "react";
import { assignRole, inviteMember, removeMember, createRole, updateRole, deleteRole, startTestRole, stopTestRole } from "@/actions/team";
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
  return tp.stages[stageId] || { create: false, modify: false, forward: false, rollback: false, delete: false };
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

  const sortedStatuses = [...taskStatuses].sort((a, b) => a.order - b.order);
  const testingRole = testingRoleId ? roles.find((r) => r.id === testingRoleId) : null;

  return (
    <div className="space-y-6">
      {/* Test Mode Banner */}
      {testingRole && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/30">
          <Play className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-amber-400 font-medium">
              Testing role: <span className="text-foreground">{testingRole.name}</span>
            </p>
            <p className="text-[11px] text-amber-400/60">You are seeing the app as this role would. Navigate around to test permissions.</p>
          </div>
          <button
            onClick={async () => {
              await stopTestRole();
              router.refresh();
            }}
            className="flex items-center gap-1.5 text-[12px] font-medium text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Square className="w-3 h-3" />
            Stop Testing
          </button>
        </div>
      )}
      {/* Members */}
      <div className="rounded-xl border border-border bg-card p-4 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-medium text-foreground">Members ({members.length})</h3>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="w-3.5 h-3.5" /> Invite
          </Button>
        </div>

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
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Email <span className="text-destructive">*</span></label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="member@company.com"
                  className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>
              <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</label>
                <input
                  name="name"
                  placeholder="Full name"
                  className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormSelect
                name="roleId"
                label="Role"
                placeholder="No role"
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
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
              <Button type="submit" size="sm"><UserPlus className="w-3.5 h-3.5" /> Invite</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 group">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                {(member.name || member.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate">{member.name || member.email}</p>
                <p className="text-[11px] text-muted-foreground">{member.email}</p>
              </div>

              {member.type === "OWNER" ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary">
                  owner
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <FormSelect
                    name={`role_${member.id}`}
                    value={member.roleId || ""}
                    placeholder="No role"
                    options={roles.map((r) => ({ value: r.id, label: r.name }))}
                    onChange={async (val) => {
                      const result = await assignRole(member.id, val || null);
                      if (!result.ok) useErrorStore.getState().push(result.error);
                    }}
                  />
                  <form action={async () => {
                    const result = await removeMember(member.id);
                    if (!result.ok) useErrorStore.getState().push(result.error);
                  }}>
                    <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
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
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-medium text-foreground">Roles</h3>
          </div>
          <div className="flex items-center gap-2">
            {roles.length === 0 && (
              <form action={seedDefaultRoles}>
                <Button type="submit" size="sm" variant="ghost">
                  <Plus className="w-3.5 h-3.5" /> Create Defaults
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
              <Plus className="w-3.5 h-3.5" /> New Role
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
                    <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-medium text-foreground truncate">{role.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">👥 {memberCount}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {testingRoleId === role.id ? (
                      <button
                        onClick={async () => {
                          await stopTestRole();
                          router.refresh();
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
                      >
                        <Square className="w-3 h-3" />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const result = await startTestRole(role.id);
                          if (result.ok) router.refresh();
                          else useErrorStore.getState().push(result.error);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title={`Test as ${role.name}`}
                      >
                        <Play className="w-3 h-3" />
                        Test
                      </button>
                    )}
                    <button
                      onClick={() => setEditingRoleId(isEditing ? null : role.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete role "${role.name}"? Members will be unassigned.`)) return;
                        const result = await deleteRole(role.id);
                        if (!result.ok) useErrorStore.getState().push(result.error);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
        className="w-full text-[14px] font-medium text-foreground bg-black border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-ring transition-colors"
      />

      {/* Module Access */}
      <div>
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Module Access</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-medium text-muted-foreground px-4 py-2.5">Module</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[80px]">None</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[80px]">View</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[80px]">Full</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_DEFS.map((mod) => (
                <tr key={mod.key} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-[13px] text-foreground">{mod.label}</p>
                    <p className="text-[10px] text-muted-foreground/60">{mod.description}</p>
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
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          None = hidden from sidebar. View = read-only access. Full = can create, edit, and delete.
        </p>
      </div>

      {/* Stage permissions table */}
      <div>
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Task Stage Permissions</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-medium text-muted-foreground px-4 py-2.5">Stage</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Create</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Modify</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Forward</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Rollback</th>
                <th className="text-center text-[11px] font-medium text-muted-foreground px-3 py-2.5 w-[72px]">Delete</th>
              </tr>
            </thead>
            <tbody>
              {taskStatuses.map((status, idx) => {
                const sp = stages[status.id] || { create: false, modify: false, forward: false, rollback: false, delete: false };
                const isFirst = idx === firstIdx;
                const isLast = idx === lastIdx;

                return (
                  <tr key={status.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-[13px] text-foreground">{status.name}</td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.create} onChange={() => toggleStage(status.id, "create")} />
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.modify} onChange={() => toggleStage(status.id, "modify")} />
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {isLast ? (
                        <span className="text-[12px] text-muted-foreground/30">—</span>
                      ) : (
                        <StageCheckbox checked={sp.forward} onChange={() => toggleStage(status.id, "forward")} />
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {isFirst ? (
                        <span className="text-[12px] text-muted-foreground/30">—</span>
                      ) : (
                        <StageCheckbox checked={sp.rollback} onChange={() => toggleStage(status.id, "rollback")} />
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <StageCheckbox checked={sp.delete} onChange={() => toggleStage(status.id, "delete")} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          Create = can create tasks in this stage. Modify = can edit tasks in this stage. Forward/Rollback = can move tasks to next/previous stage. Delete = can delete tasks in this stage.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground px-4 py-2 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-40 px-5 py-2.5 rounded-xl transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
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
      {checked && <Check className="w-3.5 h-3.5" />}
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
