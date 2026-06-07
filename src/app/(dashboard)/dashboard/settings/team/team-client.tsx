"use client";

import { useState } from "react";
import { assignRole, inviteMember, removeMember } from "@/actions/team";
import { seedDefaultRoles } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { useErrorStore } from "@/lib/error-store";
import { UserPlus, X, Shield, Plus } from "lucide-react";

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

export function TeamClient({
  members,
  roles,
}: {
  members: Member[];
  roles: Role[];
}) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Members */}
      <div className="rounded-xl border border-border bg-card p-4">
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
          {roles.length === 0 && (
            <form action={seedDefaultRoles}>
              <Button type="submit" size="sm">
                <Plus className="w-3.5 h-3.5" /> Create Default Roles
              </Button>
            </form>
          )}
        </div>
        <div className="space-y-2">
          {roles.map((role) => {
            const perms = role.permissions as Record<string, string> | null;
            return (
              <div key={role.id} className="p-3 rounded-lg bg-muted/50">
                <p className="text-[13px] font-medium text-foreground mb-1">{role.name}</p>
                {perms && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(perms).map(([module, level]) => (
                      <span
                        key={module}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          level === "full"
                            ? "bg-primary/15 text-primary"
                            : level === "view"
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {module}: {level}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
