export type ModulePermission = "full" | "view" | "none";

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

export interface Permissions {
  deals: ModulePermission;
  pipeline: ModulePermission;
  projects: ModulePermission;
  invoices: ModulePermission;
  publish: ModulePermission;
  settings: ModulePermission;
  team: ModulePermission;
  taskPermissions?: TaskPermissions;
}

export type PermissionModule = keyof Permissions;

export const DEFAULT_PERMISSIONS: Permissions = {
  deals: "full",
  pipeline: "full",
  projects: "full",
  invoices: "full",
  publish: "full",
  settings: "full",
  team: "full",
};

export const ROLE_PRESETS: Record<string, { name: string; permissions: Permissions }> = {
  admin: {
    name: "Admin",
    permissions: {
      deals: "full",
      pipeline: "full",
      projects: "full",
      invoices: "full",
      publish: "full",
      settings: "full",
      team: "full",
    },
  },
  sales: {
    name: "Sales",
    permissions: {
      deals: "full",
      pipeline: "full",
      projects: "view",
      invoices: "view",
      publish: "none",
      settings: "none",
      team: "none",
    },
  },
  delivery: {
    name: "Delivery",
    permissions: {
      deals: "view",
      pipeline: "none",
      projects: "full",
      invoices: "view",
      publish: "none",
      settings: "none",
      team: "none",
    },
  },
  finance: {
    name: "Finance",
    permissions: {
      deals: "view",
      pipeline: "none",
      projects: "view",
      invoices: "full",
      publish: "none",
      settings: "none",
      team: "none",
    },
  },
};

export interface MemberWithPermissions {
  id: string;
  userId: string;
  type: string;
  workspaceId: string;
  permissions: Permissions;
}

const MODULE_KEYS: (keyof Omit<Permissions, "taskPermissions">)[] = [
  "deals",
  "pipeline",
  "projects",
  "invoices",
  "publish",
  "settings",
  "team",
];

const LEVEL_RANK: Record<ModulePermission, number> = { none: 0, view: 1, full: 2 };

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
// permissions from the roles they hold across projects.
export function mergePermissions(list: Permissions[]): Permissions {
  const result: Permissions = {
    deals: "none",
    pipeline: "none",
    projects: "none",
    invoices: "none",
    publish: "none",
    settings: "none",
    team: "none",
    taskPermissions: { stages: {} },
  };

  for (const p of list) {
    for (const key of MODULE_KEYS) {
      const level = (p[key] as ModulePermission | undefined) ?? "none";
      if (LEVEL_RANK[level] > LEVEL_RANK[result[key] as ModulePermission]) {
        result[key] = level;
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

export function can(member: MemberWithPermissions, module: PermissionModule, requiredLevel: "view" | "full" = "view"): boolean {
  const level = member.permissions[module] as ModulePermission | undefined;
  if (level === "none") return false;
  if (level === undefined) return true;
  if (requiredLevel === "view") return level === "view" || level === "full";
  return level === "full";
}

export function canView(member: MemberWithPermissions, module: PermissionModule): boolean {
  return can(member, module, "view");
}

export function canEdit(member: MemberWithPermissions, module: PermissionModule): boolean {
  return can(member, module, "full");
}
