import { notFound, redirect } from "next/navigation";
import { getCompanyOptions } from "@/actions/companies";
import { getContactOptions } from "@/actions/contacts";
import { getDeal, getPipelineStages } from "@/actions/deals";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { NewDealClient } from "../../new/new-deal-client";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const [{ member }, deal, companies, contacts, pipeline] = await Promise.all([
    requireWorkspaceWithMember(),
    getDeal(dealId),
    getCompanyOptions(),
    getContactOptions(),
    getPipelineStages(),
  ]);
  if (!deal) notFound();
  if (!canEdit(member, "deals")) redirect(`/deals/${dealId}`);

  return (
    <NewDealClient
      companies={companies}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      }))}
      pipelineId={deal.pipeline?.id ?? pipeline?.id ?? ""}
      stages={(deal.pipeline?.stages ?? pipeline?.stages ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
      }))}
      dealId={deal.id}
      initial={{
        title: deal.title,
        value: Number(deal.value),
        stageId: deal.stageId ?? "",
        companyId: deal.companyId ?? "",
        contactId: deal.contactId ?? "",
      }}
    />
  );
}
