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

// A fine-grained switch under a module (rendered as a toggle in the module's
// expandable row in Settings → Roles). Defaults follow the module level: a
// role at "full" has every capability ON until an admin turns one off; "view"
// and "none" roles have them OFF until granted.
export type CapabilityDef = {
  key: string;
  label: string;
  /** Shown under the capability name in Settings → Roles. */
  description: string;
};

export type ModuleDef = {
  key: string;
  label: string;
  /** Shown under the module name in Settings → Roles. */
  description: string;
  /** Sidebar/nav destination gated by this module, if it has one. */
  href: string | null;
  /** Level assumed for roles saved before this module existed. */
  legacyDefault: ModulePermission;
  /** Fine-grained switches beyond none/view/full, if the module needs them. */
  capabilities?: readonly CapabilityDef[];
};

const MODULES_SOURCE = [
  // "full" legacy default: every role could see the dashboard before it became
  // permissioned, so existing roles keep it until an admin turns it off.
  { key: "dashboard", label: "Dashboard", description: "Home overview with calendar and task queue", href: "/dashboard", legacyDefault: "full" },
  { key: "companies", label: "Companies", description: "Manage company records", href: "/companies", legacyDefault: "full" },
  { key: "contacts", label: "Contacts", description: "Manage contact records", href: "/contacts", legacyDefault: "full" },
  { key: "deals", label: "CRM / Deals", description: "Manage deals and pipeline", href: "/deals", legacyDefault: "none" },
  { key: "pipeline", label: "Pipeline", description: "View and manage deal pipeline", href: null, legacyDefault: "none" },
  {
    key: "projects",
    label: "Projects",
    description: "Access project boards and tasks",
    href: "/projects",
    legacyDefault: "none",
    capabilities: [
      {
        key: "editSettings",
        label: "Modify project settings",
        description: "Change project name, photo, status, description and task templates",
      },
      {
        key: "assignMembers",
        label: "Assign people to projects",
        description: "Add or remove members on projects they have access to",
      },
    ],
  },
  { key: "invoices", label: "Invoices", description: "View and manage invoices", href: "/invoices", legacyDefault: "none" },
  { key: "payments", label: "Payments", description: "Record and manage payments received against invoices", href: "/payments", legacyDefault: "none" },
  { key: "publish", label: "Publish", description: "Schedule and publish delivery items", href: "/publish", legacyDefault: "full" },
  { key: "chat", label: "Chat", description: "Message threads and direct messages", href: "/messages", legacyDefault: "full" },
  { key: "settings", label: "Settings", description: "Access workspace settings", href: "/settings", legacyDefault: "none" },
  { key: "team", label: "Team", description: "Manage team members and roles", href: null, legacyDefault: "none" },
] as const satisfies readonly ModuleDef[];

export type ModuleKey = (typeof MODULES_SOURCE)[number]["key"];

// Widened view so `capabilities` is accessible on every element (the `as
// const` literal narrows it away on modules that don't declare any).
export const MODULES: ReadonlyArray<ModuleDef & { key: ModuleKey }> = MODULES_SOURCE;

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

/** Per-module capability flags, e.g. caps.projects.editSettings. */
export type ModuleCaps = Record<string, boolean>;

export type Permissions = { [K in ModuleKey]: ModulePermission } & {
  taskPermissions?: TaskPermissions;
  /** Fine-grained per-module capabilities (see MODULES[].capabilities).
   *  Always materialized by normalizePermissions for modules that declare
   *  capabilities. */
  caps?: Partial<Record<ModuleKey, ModuleCaps>>;
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

  // Materialize every declared capability. Resolution order:
  //   explicit stored value → legacy top-level flag → "follows the level"
  // (full ⇒ on, view/none ⇒ off). The last rule means roles saved before a
  // capability existed keep the access their level already implied.
  const rawCaps = (source.caps ?? {}) as Record<string, Record<string, unknown>>;
  result.caps = {};
  for (const mod of MODULES) {
    if (!mod.capabilities?.length) continue;
    const modCaps: ModuleCaps = {};
    for (const cap of mod.capabilities) {
      const explicit = rawCaps[mod.key]?.[cap.key];
      // "assignMembers" predates caps and was stored at the top level.
      const legacy =
        mod.key === "projects" && cap.key === "assignMembers"
          ? source.assignMembers
          : undefined;
      modCaps[cap.key] =
        typeof explicit === "boolean"
          ? explicit
          : typeof legacy === "boolean"
            ? legacy
            : result[mod.key] === "full";
    }
    result.caps[mod.key] = modCaps;
  }
  return result;
}

/** True when the member's permissions grant a module capability. */
export function hasCap(
  permissions: Permissions,
  module: ModuleKey,
  cap: string,
): boolean {
  return permissions.caps?.[module]?.[cap] === true;
}

function fullPermissions(): Permissions {
  const result = {} as Permissions;
  for (const mod of MODULES) result[mod.key] = "full";
  // normalizePermissions turns every capability on for "full" levels.
  return normalizePermissions(result);
}

export const DEFAULT_PERMISSIONS: Permissions = fullPermissions();

// Starting point for roles created from Settings → Roles.
export function newRolePermissions(): Permissions {
  return normalizePermissions({
    dashboard: "full",
    companies: "view",
    contacts: "view",
    deals: "view",
    pipeline: "none",
    projects: "view",
    invoices: "none",
    payments: "none",
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
      payments: "view",
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
      payments: "view",
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
      payments: "full",
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
  result.caps = {};

  for (const p of normalized) {
    for (const key of MODULE_KEYS) {
      if (LEVEL_RANK[p[key]] > LEVEL_RANK[result[key]]) {
        result[key] = p[key];
      }
    }
    // Capabilities merge like everything else: most permissive wins.
    for (const [modKey, modCaps] of Object.entries(p.caps ?? {})) {
      const cur = (result.caps[modKey as ModuleKey] ??= {});
      for (const [capKey, on] of Object.entries(modCaps ?? {})) {
        if (on) cur[capKey] = true;
        else cur[capKey] ??= false;
      }
    }

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

// Full project rights delete anywhere; otherwise the role's stage-level
// "Delete" flag (Settings → Roles → Task Stage Permissions) must be on for
// the task's current stage.
export function canDeleteTaskAt(
  permissions: Permissions,
  statusId: string | null,
): boolean {
  if (permissions.projects === "full") return true;
  if (!statusId) return false;
  return permissions.taskPermissions?.stages?.[statusId]?.delete === true;
}

// Full project rights move tasks anywhere; otherwise the SOURCE stage's
// Forward/Rollback flag (Settings → Roles → Task Stage Permissions) must be
// on. Tasks not yet in any stage can always be placed into one.
export function canMoveTaskFrom(
  permissions: Permissions,
  fromStatusId: string | null,
  direction: "forward" | "rollback",
): boolean {
  if (permissions.projects === "full") return true;
  if (!fromStatusId) return true;
  const stage = permissions.taskPermissions?.stages?.[fromStatusId];
  return direction === "forward"
    ? stage?.forward === true
    : stage?.rollback === true;
}

export function canView(member: MemberWithPermissions, module: ModuleKey): boolean {
  return can(member, module, "view");
}

export function canEdit(member: MemberWithPermissions, module: ModuleKey): boolean {
  return can(member, module, "full");
}
