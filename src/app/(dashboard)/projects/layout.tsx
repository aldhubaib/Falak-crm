import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

// Members assigned to at least one project are granted "view" on the
// Projects module automatically (see requireWorkspaceWithMember), so this
// only locks out members with no project involvement at all.
export default async function ProjectsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("projects");
  return children;
}
