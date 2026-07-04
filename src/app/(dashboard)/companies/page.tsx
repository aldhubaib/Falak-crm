import Link from "next/link";
import { Plus, Users, Briefcase, FolderKanban } from "lucide-react";
import { getCompanies } from "@/actions/companies";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { SurfaceCard } from "@/components/surface-card";
import { ListPager } from "@/components/list-pager";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [{ items: companies, hasMore }, { member }] = await Promise.all([
    getCompanies({ page }),
    requireWorkspaceWithMember(),
  ]);
  const editable = canEdit(member, "companies");

  return (
    <>
      <AppHeader
        title="Companies"
        actions={
          editable ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/companies/new">
                <Plus className="h-4 w-4" />
                New Company
              </Link>
            </Button>
          ) : undefined
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2 p-5">
          {companies.map((c) => (
            <Link key={c.id} href={`/companies/${c.id}`}>
              <SurfaceCard className="flex items-center gap-3 transition-colors hover:border-border">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  {c.industry && (
                    <div className="truncate text-xs text-muted-foreground">
                      {c.industry}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-tiny text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {c._count.contacts}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {c._count.deals}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FolderKanban className="h-3 w-3" /> {c._count.projects}
                  </span>
                </div>
              </SurfaceCard>
            </Link>
          ))}

          <ListPager basePath="/companies" page={page} hasMore={hasMore} />

          {companies.length === 0 && page === 1 && (
            <EmptyState
              message="No companies yet."
              action={
                editable ? (
                  <Button asChild size="sm">
                    <Link href="/companies/new">
                      <Plus className="h-4 w-4" />
                      Add Company
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
