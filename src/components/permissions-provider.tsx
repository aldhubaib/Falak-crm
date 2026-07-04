"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_PERMISSIONS, type Permissions } from "@/lib/permissions";

const PermissionsContext = createContext<Permissions>(DEFAULT_PERMISSIONS);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: Permissions;
  children: ReactNode;
}) {
  // Key on content so re-renders with an identical permission set don't
  // invalidate consumers.
  const fingerprint = JSON.stringify(permissions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => permissions, [fingerprint]);

  return (
    <PermissionsContext.Provider value={stable}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
