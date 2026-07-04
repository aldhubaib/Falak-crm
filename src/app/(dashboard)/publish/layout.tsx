import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

export default async function PublishLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("publish");
  return children;
}
