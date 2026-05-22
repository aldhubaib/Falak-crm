import { getCompany } from "@/actions/companies";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/companies"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{company.name}</h1>
          <p className="text-[12px] text-muted-foreground">
            {company.industry || "Company"}
            {company.whatsappNumber && ` • ${company.whatsappNumber}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">Details</h3>
          <dl className="space-y-2 text-sm">
            {company.phone && <InfoRow label="Phone" value={company.phone} />}
            {company.whatsappNumber && <InfoRow label="WhatsApp" value={company.whatsappNumber} />}
            {company.email && <InfoRow label="Email" value={company.email} />}
            {company.website && <InfoRow label="Website" value={company.website} />}
            {company.address && <InfoRow label="Address" value={company.address} />}
          </dl>
        </div>

        {/* Contacts */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">
            Contacts ({company.contacts.length})
          </h3>
          {company.contacts.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No contacts yet</p>
          ) : (
            <div className="space-y-2">
              {company.contacts.map((contact) => (
                <div key={contact.id} className="p-2 rounded-lg bg-muted/50">
                  <p className="text-[13px] text-foreground">{contact.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {contact.role || "No role"}{contact.whatsappNumber && ` • ${contact.whatsappNumber}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deals */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">
            Deals ({company.deals.length})
          </h3>
          {company.deals.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No deals yet</p>
          ) : (
            <div className="space-y-2">
              {company.deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/dashboard/deals/${deal.id}`}
                  className="p-2 rounded-lg bg-muted/50 block no-underline hover:bg-muted transition-colors"
                >
                  <p className="text-[13px] text-foreground">{deal.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {deal.stage.name} • {Number(deal.value).toLocaleString()} SAR
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
