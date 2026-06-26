"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type Permissions } from "@/lib/permissions";

const DEFAULT_PERMISSIONS: Permissions = {
  deals: "full",
  pipeline: "full",
  projects: "full",
  invoices: "full",
  publish: "full",
  settings: "full",
  team: "full",
};

const PermissionsContext = createContext<Permissions>(DEFAULT_PERMISSIONS);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: Permissions;
  children: ReactNode;
}) {
  const stable = useMemo(() => permissions, [
    permissions.deals,
    permissions.pipeline,
    permissions.projects,
    permissions.invoices,
    permissions.publish,
    permissions.settings,
    permissions.team,
    permissions.taskPermissions,
  ]);

  return (
    <PermissionsContext.Provider value={stable}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
