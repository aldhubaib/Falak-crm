"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Save, AlertTriangle, Pencil, Check, X, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import {
  inviteMember,
  assignRole,
  removeMember,
  renameMember,
  startImpersonation,
} from "@/actions/team";
import { assignMemberTitle, setMemberWeeklyHours } from "@/actions/titles";
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
  capacityTitle: { id: string; name: string } | null;
  weeklyHours: number;
};

type Role = {
  id: string;
  name: string;
};

type Title = {
  id: string;
  name: string;
};

export function TeamClient({
  members,
  roles,
  titles,
  canImpersonate,
}: {
  members: Member[];
  roles: Role[];
  titles: Title[];
  canImpersonate: boolean;
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

  const handleAssignTitle = (memberId: string, titleId: string) => {
    startTransition(async () => {
      await assignMemberTitle(memberId, titleId === "none" ? null : titleId);
      router.refresh();
    });
  };

  const handleWeeklyHours = (memberId: string, current: number, raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168 || parsed === current) {
      return;
    }
    startTransition(async () => {
      await setMemberWeeklyHours(memberId, parsed);
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

  // "Log in as": the whole app resolves as this member until Exit (banner)
  // or the browser session ends.
  const loginAs = (m: Member) => {
    startTransition(async () => {
      const result = await startImpersonation(m.id);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      }
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
          <SurfaceCard key={m.id} className="space-y-3">
            {/* Row 1 — identity: full name and email get the whole width. */}
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.name ?? ""} />}
                <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                  {(m.name || m.email || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
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
                    <div className="truncate text-[15px] font-semibold">
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
              {m.type !== "OWNER" && (
                <div className="flex shrink-0 items-center gap-1">
                  {canImpersonate && (
                    <IconButton
                      aria-label={`Log in as ${m.name || m.email}`}
                      title="Log in as this member"
                      onClick={() => loginAs(m)}
                      disabled={pending}
                    >
                      <LogIn className="h-4 w-4" />
                    </IconButton>
                  )}
                  <IconButton
                    aria-label="Remove member"
                    onClick={() => setToDelete(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              )}
            </div>

            {/* Row 2 — role, title, and weekly capacity, each labeled. */}
            <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Role
                </div>
                <SearchableSelect
                  value={m.role?.id ?? "none"}
                  onValueChange={(v) => handleAssignRole(m.id, v)}
                  disabled={m.type === "OWNER"}
                  searchPlaceholder="Search roles…"
                  className="h-9 w-full text-xs"
                  contentClassName="w-48 min-w-48"
                  renderValue={() => m.role?.name ?? "No role"}
                  options={[
                    { value: "none", label: "No role" },
                    ...roles.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Title
                </div>
                <SearchableSelect
                  value={m.capacityTitle?.id ?? "none"}
                  onValueChange={(v) => handleAssignTitle(m.id, v)}
                  searchPlaceholder="Search titles…"
                  className="h-9 w-full text-xs"
                  contentClassName="w-52 min-w-52"
                  renderValue={() => m.capacityTitle?.name ?? "No title"}
                  options={[
                    { value: "none", label: "No title" },
                    ...titles.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                />
              </div>
              <div title="Weekly working-hours capacity">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Capacity
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    step="any"
                    defaultValue={m.weeklyHours}
                    onBlur={(e) =>
                      handleWeeklyHours(m.id, m.weeklyHours, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="h-9 w-20 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground">h/wk</span>
                </div>
              </div>
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
