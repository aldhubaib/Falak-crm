import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

export default async function ContactsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("contacts");
  return children;
}
