import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, Globe, MapPin, Users, Briefcase, FolderKanban } from "lucide-react";
import { getCompany } from "@/actions/companies";
import { AppHeader } from "@/components/app-header";
import { SurfaceCard } from "@/components/surface-card";
import { Badge } from "@/components/ui/badge";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompany(companyId);
  if (!company) notFound();

  return (
    <>
      <AppHeader title={company.name} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-5">
          <SurfaceCard className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary">
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-lg font-semibold">{company.name}</h2>
              {company.industry && (
                <div className="text-sm text-muted-foreground">{company.industry}</div>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {company.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {company.phone}
                  </span>
                )}
                {company.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {company.email}
                  </span>
                )}
                {company.website && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> {company.website}
                  </span>
                )}
                {company.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {company.address}
                  </span>
                )}
              </div>
            </div>
          </SurfaceCard>

          {company.contacts.length > 0 && (
            <SurfaceCard>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Contacts
              </div>
              <div className="space-y-2">
                {company.contacts
                  .filter((cc) => !cc.contact.deletedAt)
                  .map((cc) => (
                    <Link
                      key={cc.contact.id}
                      href={`/contacts/${cc.contact.id}`}
                      className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-accent/40"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted/50 text-xs font-medium">
                        {(cc.contact.firstName?.[0] ?? "").toUpperCase()}
                        {(cc.contact.lastName?.[0] ?? "").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">
                          {cc.contact.firstName} {cc.contact.lastName}
                        </span>
                        {cc.role && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({cc.role})
                          </span>
                        )}
                      </div>
                      {cc.primary && (
                        <Badge variant="secondary" className="text-xxs">Primary</Badge>
                      )}
                    </Link>
                  ))}
              </div>
            </SurfaceCard>
          )}

          {company.deals.length > 0 && (
            <SurfaceCard>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" /> Deals
              </div>
              <div className="space-y-2">
                {company.deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-accent/40"
                  >
                    <span className="font-medium">{d.title}</span>
                    <Badge
                      variant={d.stage?.type === "WON" ? "default" : "secondary"}
                    >
                      {d.stage?.name ?? "—"}
                    </Badge>
                  </Link>
                ))}
              </div>
            </SurfaceCard>
          )}

          {company.projects.length > 0 && (
            <SurfaceCard>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FolderKanban className="h-3.5 w-3.5" /> Projects
              </div>
              <div className="space-y-2">
                {company.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-accent/40"
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.status && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.status.color }}
                      />
                    )}
                  </Link>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
      </main>
    </>
  );
}
