import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PermissionsProvider } from "@/components/permissions-provider";
import { CentrifugoProvider } from "@/components/realtime/centrifugo-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { getCurrentPermissions } from "@/actions/permissions";
import {
  requireWorkspaceWithMember,
  syncCurrentMemberProfile,
} from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const [permissions, { workspace, member }] = await Promise.all([
    getCurrentPermissions(),
    requireWorkspaceWithMember(),
    syncCurrentMemberProfile(),
  ]);

  return (
    <PermissionsProvider permissions={permissions}>
      <CentrifugoProvider memberId={member.id} workspaceId={workspace.id}>
        <DashboardShell>{children}</DashboardShell>
        <ServiceWorkerRegister />
      </CentrifugoProvider>
    </PermissionsProvider>
  );
}
