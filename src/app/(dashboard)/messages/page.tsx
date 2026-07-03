import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MessageCircle } from "lucide-react";

export default function MessagesPage() {
  return (
    <>
      <AppHeader title="Messages" />
      <main className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center">
        <EmptyState
          icon={MessageCircle}
          title="Messages"
          message="Team messaging is coming soon."
          className="max-w-md"
        />
      </main>
    </>
  );
}
