import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

export default async function DealsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("deals");
  return children;
}
