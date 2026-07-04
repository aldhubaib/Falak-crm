import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

// Server-side module guard: members without at least view access to
// Companies are redirected before any page in this segment renders.
export default async function CompaniesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("companies");
  return children;
}
