export type ModulePermission = "full" | "view" | "none";

// ─── Module registry ──────────────────────────────────────────────────────────
// THE single source of truth for permissioned modules. Adding a module here
// automatically:
//   • adds a row to Settings → Roles (label, in this order)
//   • gates its sidebar entry (`href`) — hidden entirely at "none"
//   • protects its routes server-side (via `guardModule` in module layouts)
//
// `legacyDefault` is the level assumed when a stored role predates the module
// (its JSON has no value for the key). Use "full" so existing roles keep the
// access they effectively had before the module became permissioned, or
// "none" to lock a new module down until an admin grants it explicitly.

export type ModuleDef = {
  key: string;
  label: string;
  /** Sidebar/nav destination gated by this module, if it has one. */
  href: string | null;
  /** Level assumed for roles saved before this module existed. */
  legacyDefault: ModulePermission;
};

export const MODULES = [
  { key: "companies", label: "Companies", href: "/companies", legacyDefault: "full" },
  { key: "contacts", label: "Contacts", href: "/contacts", legacyDefault: "full" },
  { key: "deals", label: "Deals", href: "/deals", legacyDefault: "none" },
  { key: "pipeline", label: "Pipeline", href: null, legacyDefault: "none" },
  { key: "projects", label: "Projects", href: "/projects", legacyDefault: "none" },
  { key: "invoices", label: "Invoices", href: "/invoices", legacyDefault: "none" },
  { key: "publish", label: "Publish", href: "/publish", legacyDefault: "full" },
  // Chat has no sidebar entry — the inbox opens from the notifications bell.
  { key: "chat", label: "Chat", href: null, legacyDefault: "full" },
  { key: "settings", label: "Settings", href: "/settings", legacyDefault: "none" },
  { key: "team", label: "Team", href: null, legacyDefault: "none" },
] as const satisfies readonly ModuleDef[];

export type ModuleKey = (typeof MODULES)[number]["key"];

export const MODULE_KEYS = MODULES.map((m) => m.key) as ModuleKey[];

export interface StagePermission {
  create: boolean;
  modify: boolean;
  forward: boolean;
  rollback: boolean;
  delete: boolean;
  autoAssign: boolean;
}

export interface TaskPermissions {
  stages: Record<string, StagePermission>;
}

export type Permissions = { [K in ModuleKey]: ModulePermission } & {
  taskPermissions?: TaskPermissions;
  /** Can add/remove members on projects they have access to, without
   *  needing full Projects edit rights. */
  assignMembers?: boolean;
};

export type PermissionModule = keyof Permissions;

const LEVEL_RANK: Record<ModulePermission, number> = { none: 0, view: 1, full: 2 };

// Stored role JSON may contain legacy values: "edit" (written by an older
// Roles UI) means "full"; anything unknown falls back per module.
export function normalizeLevel(
  raw: unknown,
  fallback: ModulePermission,
): ModulePermission {
  if (raw === "full" || raw === "view" || raw === "none") return raw;
  if (raw === "edit") return "full";
  return fallback;
}

// Expands an arbitrary stored permissions JSON into a complete, valid
// Permissions object. Every read of role JSON MUST go through this so that
// missing/legacy values behave predictably.
export function normalizePermissions(raw: unknown): Permissions {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result = {} as Permissions;
  for (const mod of MODULES) {
    result[mod.key] = normalizeLevel(source[mod.key], mod.legacyDefault);
  }
  const tp = source.taskPermissions as TaskPermissions | undefined;
  if (tp && typeof tp === "object") result.taskPermissions = tp;
  result.assignMembers = source.assignMembers === true;
  return result;
}

function fullPermissions(): Permissions {
  const result = {} as Permissions;
  for (const mod of MODULES) result[mod.key] = "full";
  result.assignMembers = true;
  return result;
}

export const DEFAULT_PERMISSIONS: Permissions = fullPermissions();

// Starting point for roles created from Settings → Roles.
export function newRolePermissions(): Permissions {
  return normalizePermissions({
    companies: "view",
    contacts: "view",
    deals: "view",
    pipeline: "none",
    projects: "view",
    invoices: "none",
    publish: "none",
    chat: "full",
    settings: "none",
    team: "none",
  });
}

export const ROLE_PRESETS: Record<string, { name: string; permissions: Permissions }> = {
  admin: {
    name: "Admin",
    permissions: fullPermissions(),
  },
  sales: {
    name: "Sales",
    permissions: normalizePermissions({
      companies: "full",
      contacts: "full",
      deals: "full",
      pipeline: "full",
      projects: "view",
      invoices: "view",
      publish: "none",
      chat: "full",
      settings: "none",
      team: "none",
    }),
  },
  delivery: {
    name: "Delivery",
    permissions: normalizePermissions({
      companies: "view",
      contacts: "view",
      deals: "view",
      pipeline: "none",
      projects: "full",
      invoices: "view",
      publish: "full",
      chat: "full",
      settings: "none",
      team: "none",
    }),
  },
  finance: {
    name: "Finance",
    permissions: normalizePermissions({
      companies: "view",
      contacts: "view",
      deals: "view",
      pipeline: "none",
      projects: "view",
      invoices: "full",
      publish: "none",
      chat: "full",
      settings: "none",
      team: "none",
    }),
  },
};

export interface MemberWithPermissions {
  id: string;
  userId: string;
  type: string;
  workspaceId: string;
  permissions: Permissions;
}

const EMPTY_STAGE: StagePermission = {
  create: false,
  modify: false,
  forward: false,
  rollback: false,
  delete: false,
  autoAssign: false,
};

// Combines several permission sets into one, taking the most permissive
// module level and OR-ing task-stage flags. Used to compute a member's global
// permissions from the roles they hold across projects. Inputs are raw stored
// JSON — normalization happens here.
export function mergePermissions(list: unknown[]): Permissions {
  const normalized = list.map(normalizePermissions);

  const result = {} as Permissions;
  for (const mod of MODULES) {
    // With no roles at all, everything is "none" (owners never reach merge).
    result[mod.key] = "none";
  }
  result.taskPermissions = { stages: {} };
  result.assignMembers = false;

  for (const p of normalized) {
    for (const key of MODULE_KEYS) {
      if (LEVEL_RANK[p[key]] > LEVEL_RANK[result[key]]) {
        result[key] = p[key];
      }
    }
    if (p.assignMembers) result.assignMembers = true;

    const stages = p.taskPermissions?.stages ?? {};
    for (const [stageId, sp] of Object.entries(stages)) {
      const cur = result.taskPermissions!.stages[stageId] ?? { ...EMPTY_STAGE };
      result.taskPermissions!.stages[stageId] = {
        create: cur.create || sp.create,
        modify: cur.modify || sp.modify,
        forward: cur.forward || sp.forward,
        rollback: cur.rollback || sp.rollback,
        delete: cur.delete || sp.delete,
        autoAssign: cur.autoAssign || sp.autoAssign,
      };
    }
  }

  return result;
}

export function can(
  member: MemberWithPermissions,
  module: ModuleKey,
  requiredLevel: "view" | "full" = "view",
): boolean {
  const level = normalizeLevel(
    member.permissions[module],
    MODULES.find((m) => m.key === module)?.legacyDefault ?? "none",
  );
  if (level === "none") return false;
  if (requiredLevel === "view") return level === "view" || level === "full";
  return level === "full";
}

export function canView(member: MemberWithPermissions, module: ModuleKey): boolean {
  return can(member, module, "view");
}

export function canEdit(member: MemberWithPermissions, module: ModuleKey): boolean {
  return can(member, module, "full");
}
