import { notFound } from "next/navigation";
import Link from "next/link";
import { Edit3 } from "lucide-react";
import { getDeal } from "@/actions/deals";
import { getCompanyOptions } from "@/actions/companies";
import { getContactOptions } from "@/actions/contacts";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { SurfaceCard } from "@/components/surface-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DealActions } from "./deal-actions";
import { RelatedData } from "@/components/crm/related-records";
import { DealStagePath } from "./deal-stage-path";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const [{ member }, deal, companyOptions, contactOptions] = await Promise.all([
    requireWorkspaceWithMember(),
    getDeal(dealId),
    getCompanyOptions(),
    getContactOptions(),
  ]);
  if (!deal) notFound();
  const editable = canEdit(member, "deals");
  const canMoveStage = canEdit(member, "pipeline");

  const subtotal = deal.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );

  return (
    <>
      <AppHeader
        title={deal.title}
        backHref="/deals"
        actions={
          editable ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full"
            >
              <Link href={`/deals/${deal.id}/edit`}>
                <Edit3 className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : undefined
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-5">
          <SurfaceCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{deal.title}</h2>
              {deal.company && (
                <Link
                  href={`/companies/${deal.company.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {deal.company.name}
                </Link>
              )}
              {deal.contact && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Contact: {deal.contact.firstName} {deal.contact.lastName}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">
                {Number(deal.value).toLocaleString()}{" "}
                <span className="text-sm text-muted-foreground">{deal.currency}</span>
              </div>
              <Badge
                className="mt-1"
                variant={
                  deal.stage?.type === "WON"
                    ? "default"
                    : deal.stage?.type === "LOST"
                      ? "destructive"
                      : "secondary"
                }
              >
                {deal.stage?.name ?? "Unknown"}
              </Badge>
            </div>
          </SurfaceCard>

          {deal.pipeline && (
            <SurfaceCard>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pipeline Progress
              </div>
              <DealStagePath
                dealId={deal.id}
                stages={deal.pipeline.stages.map((s) => ({
                  id: s.id,
                  name: s.name,
                  order: s.order,
                }))}
                currentStageId={deal.stage?.id ?? null}
                currentOrder={deal.stage?.order ?? 0}
                editable={canMoveStage}
              />
            </SurfaceCard>
          )}

          {deal.items.length > 0 && (
            <SurfaceCard>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Line Items
              </div>
              <div className="space-y-2">
                {deal.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{item.service?.name ?? item.description}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {item.quantity} &times;{" "}
                      {Number(item.unitPrice).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border/40 pt-2 flex justify-between font-semibold text-sm">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {subtotal.toLocaleString()} {deal.currency}
                  </span>
                </div>
              </div>
            </SurfaceCard>
          )}

          <RelatedData
            entity={{
              type: "deal",
              id: deal.id,
              companyId: deal.company?.id ?? null,
              companyName: deal.company?.name ?? null,
            }}
            companies={
              deal.company
                ? [
                    {
                      id: deal.company.id,
                      name: deal.company.name,
                      email: deal.company.email,
                      phone: deal.company.phone,
                    },
                  ]
                : []
            }
            contacts={(deal.company?.contacts ?? []).map((link) => ({
              id: link.contact.id,
              name: [link.contact.firstName, link.contact.lastName]
                .filter(Boolean)
                .join(" "),
              email: link.contact.email,
              phone: link.contact.mobile,
            }))}
            companyOptions={companyOptions.map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: [c.email, c.phone].filter(Boolean).join(" · "),
            }))}
            contactOptions={contactOptions.map((c) => ({
              id: c.id,
              title: [c.firstName, c.lastName].filter(Boolean).join(" "),
              subtitle: [c.email, c.mobile].filter(Boolean).join(" · "),
            }))}
          />

          <DealActions
            dealId={deal.id}
            stageType={deal.stage?.type ?? "OPEN"}
            hasProject={!!deal.project}
            projectId={deal.project?.id}
          />
        </div>
      </main>
    </>
  );
}
