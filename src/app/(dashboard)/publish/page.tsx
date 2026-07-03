import { getPublishableProjects } from "@/actions/publish";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { CalendarDays } from "lucide-react";

export default async function PublishPage() {
  const projects = await getPublishableProjects();

  return (
    <>
      <AppHeader title="Publish" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center p-10">
          <EmptyState
            icon={CalendarDays}
            title="Calendar View"
            message={
              projects.length > 0
                ? `${projects.length} project${projects.length > 1 ? "s" : ""} ready for publishing. Calendar view coming soon.`
                : "No projects with publishing enabled yet."
            }
            className="max-w-md"
          />
        </div>
      </main>
    </>
  );
}
