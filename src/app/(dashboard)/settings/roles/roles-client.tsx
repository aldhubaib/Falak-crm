"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus, ChevronDown, ChevronUp, Trash2, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { AddItemInput } from "@/components/add-item-input";
import { IconButton } from "@/components/icon-button";
import { Switch } from "@/components/ui/switch";
import { createRole, updateRole, deleteRole } from "@/actions/team";
import { cn } from "@/lib/utils";

type Role = {
  id: string;
  name: string;
  permissions: unknown;
};

const PERMISSION_KEYS = [
  { key: "deals", label: "Deals" },
  { key: "pipeline", label: "Pipeline" },
  { key: "projects", label: "Projects" },
  { key: "invoices", label: "Invoices" },
  { key: "settings", label: "Settings" },
  { key: "team", label: "Team" },
] as const;

const LEVELS = ["none", "view", "edit"] as const;

export function RolesClient({
  roles,
  memberCounts,
}: {
  roles: Role[];
  memberCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [toDelete, setToDelete] = useState<Role | null>(null);

  const addRole = () => {
    const n = newName.trim();
    if (!n) {
      setError("Enter a role name");
      setShake((s) => s + 1);
      return;
    }
    if (roles.some((r) => r.name.toLowerCase() === n.toLowerCase())) {
      setError("A role with this name already exists");
      setShake((s) => s + 1);
      return;
    }
    startTransition(async () => {
      const result = await createRole(n);
      if (result.ok) {
        setNewName("");
        setError(null);
        setExpanded(result.data);
        router.refresh();
      }
    });
  };

  const updatePermission = (
    role: Role,
    key: string,
    level: string,
  ) => {
    const perms = (role.permissions as Record<string, string>) || {};
    const updated = { ...perms, [key]: level };
    startTransition(async () => {
      await updateRole(role.id, { permissions: updated });
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      await deleteRole(toDelete.id);
      setToDelete(null);
      if (expanded === toDelete.id) setExpanded(null);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-5xl">
      <SurfaceCard padding="sm">
        <div className="mb-2 flex items-center gap-2 text-hint text-muted-foreground">
          <ShieldPlus className="h-3.5 w-3.5" />
          Add a new role
        </div>
        <AddItemInput
          key={shake}
          value={newName}
          onChange={(v) => {
            setNewName(v);
            if (error) setError(null);
          }}
          onAdd={addRole}
          addLabel="Add role"
          placeholder="Role name (e.g. Editor)"
          inputClassName={cn(
            error &&
              "border-destructive text-destructive animate-shake focus-visible:ring-destructive/40",
          )}
        />
        {error && (
          <div className="mt-2 text-hint text-destructive">{error}</div>
        )}
      </SurfaceCard>

      {roles.map((r) => {
        const count = memberCounts[r.id] ?? 0;
        const isExpanded = expanded === r.id;
        const perms = (r.permissions as Record<string, string>) || {};

        return (
          <SurfaceCard key={r.id} padding="none">
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : r.id)}
              className="flex w-full items-center gap-3 p-3 text-left sm:p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {count} member
                  {count !== 1 ? "s" : ""}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-border/40 p-3 sm:p-4">
                <div className="space-y-3">
                  {PERMISSION_KEYS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-sm">{label}</span>
                      <div className="flex gap-1">
                        {LEVELS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => updatePermission(r, key, level)}
                            disabled={pending}
                            className={cn(
                              "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                              perms[key] === level
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete role
                  </Button>
                </div>
              </div>
            )}
          </SurfaceCard>
        );
      })}

      {roles.length === 0 && <EmptyState message="No roles yet." />}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete role &quot;{toDelete?.name}&quot;?</DialogTitle>
            <DialogDescription>
              {(memberCounts[toDelete?.id ?? ""] ?? 0) > 0
                ? `${memberCounts[toDelete?.id ?? ""]} member(s) have this role. They will be unassigned.`
                : "This role will be removed. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
