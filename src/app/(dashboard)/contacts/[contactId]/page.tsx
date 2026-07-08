import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, MapPin, FileText } from "lucide-react";
import { getContact } from "@/actions/contacts";
import { getCompanyOptions } from "@/actions/companies";
import { getDealOptions } from "@/actions/deals";
import { AppHeader } from "@/components/app-header";
import { SurfaceCard } from "@/components/surface-card";
import { RelatedData } from "@/components/crm/related-records";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const [contact, companyOptions, dealOptions] = await Promise.all([
    getContact(contactId),
    getCompanyOptions(),
    getDealOptions(),
  ]);
  if (!contact) notFound();

  const fullName = [contact.firstName, contact.middleName, contact.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <AppHeader title={fullName} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-5">
          <SurfaceCard className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary">
              {(contact.firstName?.[0] ?? "").toUpperCase()}
              {(contact.lastName?.[0] ?? "").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-lg font-semibold">{fullName}</h2>
              {contact.role && (
                <div className="text-sm text-muted-foreground">{contact.role}</div>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {contact.mobile && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {contact.mobile}
                  </span>
                )}
                {contact.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {contact.email}
                  </span>
                )}
                {contact.country && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {contact.country}
                  </span>
                )}
              </div>
            </div>
          </SurfaceCard>

          <RelatedData
            entity={{ type: "contact", id: contact.id }}
            companies={contact.companies.map((cc) => ({
              id: cc.company.id,
              name: cc.company.name,
              email: cc.company.email,
              phone: cc.company.phone,
            }))}
            deals={contact.deals.map((d) => ({
              id: d.id,
              title: d.title,
              stageName: d.stage?.name ?? null,
              value: Number(d.value),
            }))}
            companyOptions={companyOptions.map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: [c.email, c.phone].filter(Boolean).join(" · "),
            }))}
            dealOptions={dealOptions.map((d) => ({
              id: d.id,
              title: d.title,
              subtitle: d.stage?.name ?? "",
            }))}
          />

          {contact.invoices.length > 0 && (
            <SurfaceCard>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Invoices
              </div>
              <div className="space-y-2">
                {contact.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-accent/40"
                  >
                    <span className="font-medium">{inv.number}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {Number(inv.total).toLocaleString()} {inv.currency}
                    </span>
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
