export type ModulePermission = "full" | "view" | "none";

export interface Permissions {
  deals: ModulePermission;
  pipeline: ModulePermission;
  projects: ModulePermission;
  invoices: ModulePermission;
  settings: ModulePermission;
  team: ModulePermission;
}

export type PermissionModule = keyof Permissions;

export const DEFAULT_PERMISSIONS: Permissions = {
  deals: "full",
  pipeline: "full",
  projects: "full",
  invoices: "full",
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

export function can(member: MemberWithPermissions, module: PermissionModule, requiredLevel: "view" | "full" = "view"): boolean {
  const level = member.permissions[module];
  if (level === "none") return false;
  if (requiredLevel === "view") return level === "view" || level === "full";
  return level === "full";
}

export function canView(member: MemberWithPermissions, module: PermissionModule): boolean {
  return can(member, module, "view");
}

export function canEdit(member: MemberWithPermissions, module: PermissionModule): boolean {
  return can(member, module, "full");
}
