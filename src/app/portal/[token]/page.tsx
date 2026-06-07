import { getPortalDeal } from "@/actions/deal-access";
import { notFound } from "next/navigation";
import { PortalClient } from "./portal-client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params;
  const data = await getPortalDeal(token);

  if (!data) notFound();

  return <PortalClient data={data} />;
}
