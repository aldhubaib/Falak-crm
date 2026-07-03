import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Trash2 } from "lucide-react";

export default function TrashPage() {
  return (
    <>
      <AppHeader title="Trash" />
      <main className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center">
        <EmptyState
          icon={Trash2}
          title="Trash"
          message="Deleted items will appear here. Trash management coming soon."
          className="max-w-md"
        />
      </main>
    </>
  );
}
