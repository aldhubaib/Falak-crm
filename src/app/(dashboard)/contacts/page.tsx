import Link from "next/link";
import { Plus, Phone, Mail } from "lucide-react";
import { getContacts } from "@/actions/contacts";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { SurfaceCard } from "@/components/surface-card";
import { ListPager } from "@/components/list-pager";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [{ items: contacts, hasMore }, { member }] = await Promise.all([
    getContacts({ page }),
    requireWorkspaceWithMember(),
  ]);
  const editable = canEdit(member, "contacts");

  return (
    <>
      <AppHeader
        title="Contacts"
        actions={
          editable ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/contacts/new">
                <Plus className="h-4 w-4" />
                New Contact
              </Link>
            </Button>
          ) : undefined
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2 p-5">
          {contacts.map((c) => {
            const fullName = [c.firstName, c.middleName, c.lastName]
              .filter(Boolean)
              .join(" ");
            const primaryCompany = c.companies.find((cc) => cc.primary);

            return (
              <Link key={c.id} href={`/contacts/${c.id}`}>
                <SurfaceCard className="flex items-center gap-3 transition-colors hover:border-border">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {(c.firstName?.[0] ?? "").toUpperCase()}
                    {(c.lastName?.[0] ?? "").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{fullName}</span>
                      {c.role && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {c.role}
                        </span>
                      )}
                    </div>
                    {primaryCompany && (
                      <div className="truncate text-xs text-muted-foreground">
                        {primaryCompany.company.name}
                      </div>
                    )}
                  </div>
                  <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                    {c.mobile && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.mobile}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </SurfaceCard>
              </Link>
            );
          })}

          <ListPager basePath="/contacts" page={page} hasMore={hasMore} />

          {contacts.length === 0 && page === 1 && (
            <EmptyState
              message="No contacts yet."
              action={
                editable ? (
                  <Button asChild size="sm">
                    <Link href="/contacts/new">
                      <Plus className="h-4 w-4" />
                      Add Contact
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
