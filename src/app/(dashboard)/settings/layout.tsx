import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("settings");
  return children;
}
