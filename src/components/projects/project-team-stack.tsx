"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, UserPlus, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  addProjectMember,
  setProjectMemberRole,
  removeProjectMember,
} from "@/actions/projects";
import { cn } from "@/lib/utils";

export type ProjectTeamMember = {
  memberId: string;
  name: string;
  email: string;
  imageUrl?: string | null;
  roleId: string | null;
  roleName: string | null;
};

export type ProjectTeamCandidate = {
  id: string;
  name: string;
  email: string;
  imageUrl?: string | null;
};

export type ProjectTeamRole = { id: string; name: string };

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function MemberAvatar({
  name,
  imageUrl,
  size = 32,
  ring = false,
  muted = false,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  ring?: boolean;
  muted?: boolean;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          "shrink-0 rounded-full object-cover",
          ring && "border-2 border-background",
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold leading-none",
        ring && "border-2 border-background",
        muted ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function ProjectTeamStack({
  projectId,
  canEdit,
  members,
  candidates,
  roles,
}: {
  projectId: string;
  canEdit: boolean;
  members: ProjectTeamMember[];
  candidates: ProjectTeamCandidate[];
  roles: ProjectTeamRole[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((m) =>
      q
        ? m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        : true,
    );
  }, [candidates, query]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

  const defaultRoleId = () =>
    roles.find((r) => /member/i.test(r.name))?.id ?? roles[0]?.id ?? null;

  const roleName = (id: string | null) =>
    id ? (roles.find((r) => r.id === id)?.name ?? "Member") : "No role";

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const addMember = (memberId: string) =>
    run(() => addProjectMember(projectId, memberId, defaultRoleId()));
  const changeRole = (memberId: string, roleId: string) =>
    run(() => setProjectMemberRole(projectId, memberId, roleId));
  const remove = (memberId: string) =>
    run(() => removeProjectMember(projectId, memberId));

  const MAX = 3;
  const shown = members.slice(0, MAX);
  const extra = members.length - shown.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Project team"
          className="flex items-center -space-x-2 rounded-full p-0.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {members.length === 0 ? (
            <span className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
            </span>
          ) : (
            <>
              {shown.map((m) => (
                <span key={m.memberId} title={`${m.name} · ${roleName(m.roleId)}`}>
                  <MemberAvatar name={m.name} imageUrl={m.imageUrl} size={28} ring />
                </span>
              ))}
              {extra > 0 && (
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-muted text-xxs font-medium text-foreground">
                  +{extra}
                </span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <div className="border-b border-border/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              Project team
              {pending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="text-tiny text-muted-foreground">
              {members.length} member{members.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-auto p-1">
          {filteredMembers.length > 0 && (
            <>
              <div className="px-2 pb-1 pt-1.5 text-xxs font-medium uppercase tracking-wider text-muted-foreground">
                On this project
              </div>
              {filteredMembers.map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center gap-2 rounded-md px-2 py-2"
                >
                  <MemberAvatar name={m.name} imageUrl={m.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                  </div>
                  {canEdit ? (
                    <>
                      <Select
                        value={m.roleId ?? ""}
                        onValueChange={(v) => changeRole(m.memberId, v)}
                        disabled={pending || roles.length === 0}
                      >
                        <SelectTrigger className="h-7 w-32 border-transparent bg-muted/40 text-xs hover:bg-muted [&>span]:truncate">
                          <SelectValue>{roleName(m.roleId)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => remove(m.memberId)}
                        disabled={pending}
                        aria-label={`Remove ${m.name}`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      {roleName(m.roleId)}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}

          {canEdit && available.length > 0 && (
            <>
              <div
                className={cn(
                  "px-2 pb-1 text-xxs font-medium uppercase tracking-wider text-muted-foreground",
                  filteredMembers.length > 0 ? "pt-3" : "pt-1.5",
                )}
              >
                Add member
              </div>
              {available.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={pending}
                  onClick={() => addMember(m.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <MemberAvatar name={m.name} imageUrl={m.imageUrl} muted />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                  </div>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </>
          )}

          {candidates.length === 0 && members.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No team members yet. Invite people from Settings › Team.
            </div>
          )}
          {query.trim() &&
            filteredMembers.length === 0 &&
            available.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matches for “{query}”.
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
