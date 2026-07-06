"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Save, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import { inviteMember, assignRole, removeMember, renameMember } from "@/actions/team";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  type: string;
  joinedAt: Date;
  role: { id: string; name: string } | null;
};

type Role = {
  id: string;
  name: string;
};

export function TeamClient({
  members,
  roles,
}: {
  members: Member[];
  roles: Role[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [toDelete, setToDelete] = useState<Member | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const flagError = (msg: string) => {
    setError(msg);
    setShake((n) => n + 1);
  };

  const invite = () => {
    const value = email.trim();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      flagError("First name and last name are required");
      return;
    }
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      flagError(value ? "Enter a valid email address" : "Email is required");
      return;
    }
    if (members.some((m) => m.email?.toLowerCase() === value.toLowerCase())) {
      flagError("That email is already on the team");
      return;
    }

    const fd = new FormData();
    fd.set("email", value);
    fd.set("name", `${first} ${last}`);
    fd.set("type", "MEMBER");

    startTransition(async () => {
      await inviteMember(fd);
      setEmail("");
      setFirstName("");
      setLastName("");
      setError(null);
      router.refresh();
    });
  };

  const handleAssignRole = (memberId: string, roleId: string) => {
    startTransition(async () => {
      await assignRole(memberId, roleId === "none" ? null : roleId);
      router.refresh();
    });
  };

  const startRename = (m: Member) => {
    setEditingId(m.id);
    setEditName(m.name ?? "");
  };

  const saveRename = () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    const id = editingId;
    setEditingId(null);
    startTransition(async () => {
      await renameMember(id, name);
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      await removeMember(toDelete.id);
      setToDelete(null);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-2xl">
      <SurfaceCard padding="sm">
        <div className="mb-2 flex items-center gap-2 text-hint text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" />
          Invite by email
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (error) setError(null);
              }}
              className="min-w-0"
            />
            <Input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (error) setError(null);
              }}
              className="min-w-0"
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input
              key={shake}
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              aria-invalid={!!error}
              className={cn(
                "min-w-0",
                error &&
                  "border-destructive text-destructive animate-shake focus-visible:ring-destructive/40",
              )}
            />
            <Button
              size="icon"
              onClick={invite}
              aria-label="Send invite"
              className="shrink-0"
              disabled={pending}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-hint text-destructive">{error}</div>
        )}
      </SurfaceCard>

      <div className="space-y-field-gap">
        {members.map((m) => (
          <SurfaceCard
            key={m.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3"
          >
            <Avatar className="h-9 w-9 shrink-0">
              {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.name ?? ""} />}
              <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                {(m.name || m.email || "U").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {editingId === m.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8 min-w-0 text-sm"
                    placeholder="Full name"
                  />
                  <IconButton aria-label="Save name" onClick={saveRename}>
                    <Check className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <div className="truncate font-medium">
                    {m.name || m.email || "Unknown"}
                  </div>
                  {m.type === "OWNER" && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-primary">
                      Owner
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Edit name"
                    onClick={() => startRename(m)}
                    className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="truncate text-xs text-muted-foreground">
                {m.email}
              </div>
            </div>
            <div className="col-span-3 flex items-center gap-2 sm:col-span-1">
              <Select
                value={m.role?.id ?? "none"}
                onValueChange={(v) => handleAssignRole(m.id, v)}
                disabled={m.type === "OWNER"}
              >
                <SelectTrigger className="h-8 w-full text-xs sm:w-32">
                  <SelectValue>
                    {m.role?.name ?? "No role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {m.type !== "OWNER" && (
                <IconButton
                  aria-label="Remove member"
                  onClick={() => setToDelete(m)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </SurfaceCard>
        ))}
        {members.length === 0 && <EmptyState message="No members yet." />}
      </div>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>
              Remove {toDelete?.name || toDelete?.email}?
            </DialogTitle>
            <DialogDescription>
              They will lose access immediately. This action cannot be undone.
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
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
