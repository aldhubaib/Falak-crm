import { getCompany } from "@/actions/companies";
import { notFound } from "next/navigation";
import { CompanyDetailClient } from "./company-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  return <CompanyDetailClient company={company} />;
}
