import type { ReactNode } from "react";
import { requireScriptPage } from "@/modules/script/integration";

export default async function ScriptsLayout({ children }: { children: ReactNode }) {
  await requireScriptPage();
  return children;
}
