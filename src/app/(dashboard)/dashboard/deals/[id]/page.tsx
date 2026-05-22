import { getDeal } from "@/actions/deals";
import { getServices } from "@/actions/services";
import { notFound } from "next/navigation";
import { DealDetailClient } from "./deal-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params;
  const [deal, services] = await Promise.all([getDeal(id), getServices()]);
  if (!deal) notFound();

  return (
    <DealDetailClient
      deal={deal}
      services={services.map((s) => ({ id: s.id, name: s.name, unitPrice: Number(s.unitPrice) }))}
    />
  );
}
