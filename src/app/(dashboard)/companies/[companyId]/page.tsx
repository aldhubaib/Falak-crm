import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, Globe, MapPin, FolderKanban } from "lucide-react";
import { getCompany } from "@/actions/companies";
import { getContactOptions } from "@/actions/contacts";
import { getDealOptions } from "@/actions/deals";
import { AppHeader } from "@/components/app-header";
import { SurfaceCard } from "@/components/surface-card";
import { RelatedData } from "@/components/crm/related-records";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const [company, contactOptions, dealOptions] = await Promise.all([
    getCompany(companyId),
    getContactOptions(),
    getDealOptions(),
  ]);
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

          <RelatedData
            entity={{ type: "company", id: company.id }}
            contacts={company.contacts
              .filter((cc) => !cc.contact.deletedAt)
              .map((cc) => ({
                id: cc.contact.id,
                name: [cc.contact.firstName, cc.contact.lastName]
                  .filter(Boolean)
                  .join(" "),
                email: cc.contact.email,
                phone: cc.contact.mobile,
              }))}
            deals={company.deals.map((d) => ({
              id: d.id,
              title: d.title,
              stageName: d.stage?.name ?? null,
              value: Number(d.value),
            }))}
            contactOptions={contactOptions.map((c) => ({
              id: c.id,
              title: [c.firstName, c.lastName].filter(Boolean).join(" "),
              subtitle: [c.email, c.mobile].filter(Boolean).join(" · "),
            }))}
            dealOptions={dealOptions.map((d) => ({
              id: d.id,
              title: d.title,
              subtitle: d.stage?.name ?? "",
            }))}
          />

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
