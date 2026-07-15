import type { ReactNode } from "react";
import { requireModuleView } from "@/lib/workspace";
import { getInboxThreads } from "@/actions/messages";
import { ThreadSidebar, MessagesMain } from "./messages-client";

export default async function MessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModuleView("chat");
  const threads = await getInboxThreads();

  // A normal page inside the dashboard shell (app sidebar stays visible) —
  // it used to render as a fixed fullscreen overlay.
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <ThreadSidebar threads={threads} />
      <MessagesMain>{children}</MessagesMain>
    </div>
  );
}
