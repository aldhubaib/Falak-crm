import { getDeal } from "@/actions/deals";
import { getServices } from "@/actions/services";
import { getTaskStatuses, getProjectStatuses } from "@/actions/settings";
import { notFound } from "next/navigation";
import { DealDetailClient } from "./deal-detail-client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function DealDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  const [deal, services, taskStatuses, projectStatuses] = await Promise.all([
    getDeal(id),
    getServices(),
    getTaskStatuses(),
    getProjectStatuses(),
  ]);

  if (!deal) notFound();

  return (
    <DealDetailClient
      deal={deal}
      services={services.map((s) => ({ id: s.id, name: s.name, unitPrice: Number(s.unitPrice) }))}
      taskStatuses={taskStatuses}
      projectStatuses={projectStatuses}
      initialTab={tab}
    />
  );
}
