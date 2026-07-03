import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PermissionsProvider } from "@/components/permissions-provider";
import { getCurrentPermissions } from "@/actions/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const permissions = await getCurrentPermissions();

  return (
    <PermissionsProvider permissions={permissions}>
      <DashboardShell>{children}</DashboardShell>
    </PermissionsProvider>
  );
}
