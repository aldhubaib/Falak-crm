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

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 bg-background text-foreground">
      <ThreadSidebar threads={threads} />
      <MessagesMain>{children}</MessagesMain>
    </div>
  );
}
