import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PermissionsProvider } from "@/components/permissions-provider";
import { CentrifugoProvider } from "@/components/realtime/centrifugo-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { OfflineBanner } from "@/components/offline-banner";
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
    // Diagnostics for the intermittent-logout reports: every forced sign-in
    // redirect is logged with enough context to correlate with device reports.
    try {
      const h = await headers();
      console.warn(
        `[auth] dashboard layout redirect -> /sign-in ua="${h.get("user-agent") ?? "?"}" at=${new Date().toISOString()}`,
      );
    } catch {}
    redirect("/sign-in");
  }

  const [permissions, { workspace, member }] = await Promise.all([
    getCurrentPermissions(),
    requireWorkspaceWithMember(),
  ]);

  // Fire-and-forget: Clerk profile sync is throttled (15 min/user) and must
  // never sit on the render critical path.
  void syncCurrentMemberProfile();

  return (
    <PermissionsProvider permissions={permissions}>
      <CentrifugoProvider memberId={member.id} workspaceId={workspace.id}>
        <DashboardShell>{children}</DashboardShell>
        <ServiceWorkerRegister />
        <OfflineBanner />
      </CentrifugoProvider>
    </PermissionsProvider>
  );
}
