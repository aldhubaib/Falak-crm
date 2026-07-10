import Link from "next/link";
import { Plus } from "lucide-react";
import {
  getActiveProjectsDashboard,
  getThisWeekSchedule,
} from "@/actions/projects-dashboard";
import { getMyResponsibility } from "@/actions/responsibility";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { ActiveProjectsStat } from "@/components/dashboard/active-projects-stat";
import { MyResponsibilityModule } from "@/components/dashboard/my-responsibility-module";
import { WeeklyScheduleModule } from "@/components/dashboard/weekly-schedule-module";

export default async function ProjectsPage() {
  const [{ member }, activeProjects, responsibility, thisWeek] =
    await Promise.all([
      requireWorkspaceWithMember(),
      getActiveProjectsDashboard(),
      getMyResponsibility(),
      getThisWeekSchedule(),
    ]);
  const editable = canEdit(member, "projects");

  return (
    <>
      <AppHeader
        title="Projects"
        actions={
          editable ? (
            <Button asChild size="icon" className="rounded-full" aria-label="New Project">
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto max-w-[1600px]">
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ActiveProjectsStat projects={activeProjects} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MyResponsibilityModule data={responsibility} />
            <WeeklyScheduleModule data={thisWeek} />
          </div>
        </PageContainer>
      </main>
    </>
  );
}
