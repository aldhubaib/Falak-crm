"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type Permissions } from "@/lib/permissions";

const DEFAULT_PERMISSIONS: Permissions = {
  deals: "full",
  pipeline: "full",
  projects: "full",
  invoices: "full",
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
  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
