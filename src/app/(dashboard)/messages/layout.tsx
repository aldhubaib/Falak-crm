import type { ReactNode } from "react";
import { getInboxThreads } from "@/actions/messages";
import { ThreadSidebar } from "./messages-client";

export default async function MessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const threads = await getInboxThreads();

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 bg-background text-foreground">
      <ThreadSidebar threads={threads} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
