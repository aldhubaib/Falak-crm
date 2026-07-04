import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

export default async function InvoicesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("invoices");
  return children;
}
