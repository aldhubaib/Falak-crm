import { getService } from "@/actions/services";
import { notFound } from "next/navigation";
import { ServiceDetailClient } from "./service-detail-client";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();
  return <ServiceDetailClient service={service} />;
}
