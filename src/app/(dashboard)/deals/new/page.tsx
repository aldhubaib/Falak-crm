import { getCompanyOptions } from "@/actions/companies";
import { getContactOptions } from "@/actions/contacts";
import { getPipelineStages } from "@/actions/deals";
import { NewDealClient } from "./new-deal-client";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const [{ companyId }, companies, contacts, pipeline] = await Promise.all([
    searchParams,
    getCompanyOptions(),
    getContactOptions(),
    getPipelineStages(),
  ]);

  return (
    <NewDealClient
      companies={companies}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      }))}
      pipelineId={pipeline?.id ?? ""}
      stages={(pipeline?.stages ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
      }))}
      initialCompanyId={companyId}
    />
  );
}
