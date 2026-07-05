"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RoleCard } from "@/components/roles/role-card";
import type { RoleDTO, TaskStageDTO } from "@/components/roles/role-editor";
import { createRole, deleteRole, startTestRole } from "@/actions/team";
import { cn } from "@/lib/utils";

export function RolesClient({
  roles,
  stages,
  memberCounts,
}: {
  roles: RoleDTO[];
  stages: TaskStageDTO[];
  memberCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [toDelete, setToDelete] = useState<RoleDTO | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

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
      } else {
        setError(result.error.message);
        setShake((s) => s + 1);
      }
    });
  };

  const countFor = (id: string) => memberCounts[id] ?? 0;

  const affected = toDelete ? countFor(toDelete.id) : 0;
  const targets = toDelete ? roles.filter((r) => r.id !== toDelete.id) : [];
  const openDelete = (r: RoleDTO) => {
    setToDelete(r);
    setReassignTo("");
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    if (affected > 0 && !reassignTo) return;
    startTransition(async () => {
      await deleteRole(toDelete.id, affected > 0 ? reassignTo : undefined);
      if (expanded === toDelete.id) setExpanded(null);
      setToDelete(null);
      router.refresh();
    });
  };

  const testRole = (r: RoleDTO) => {
    startTransition(async () => {
      const result = await startTestRole(r.id);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      }
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
        {error && <div className="mt-2 text-hint text-destructive">{error}</div>}
      </SurfaceCard>

      {roles.map((r) => (
        <RoleCard
          key={r.id}
          role={r}
          stages={stages}
          count={countFor(r.id)}
          expanded={expanded === r.id}
          onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
          onClose={() => setExpanded(null)}
          onDelete={() => openDelete(r)}
          onTest={() => testRole(r)}
        />
      ))}
      {roles.length === 0 && <EmptyState message="No roles yet." />}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete role &quot;{toDelete?.name}&quot;?</DialogTitle>
            <DialogDescription>
              {affected > 0
                ? `${affected} member${affected === 1 ? "" : "s"} currently have this role. Move them to another role before deleting.`
                : "This role will be removed. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>

          {affected > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Move members to
              </label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {targets.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No other roles available
                    </div>
                  ) : (
                    targets.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending || (affected > 0 && !reassignTo)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
