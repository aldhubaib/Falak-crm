import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

// Members whose role sets Dashboard to "none" are redirected to their first
// accessible module instead.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("dashboard");
  return children;
}
