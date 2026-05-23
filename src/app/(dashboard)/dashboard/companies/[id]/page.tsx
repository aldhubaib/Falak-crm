import { getCompany } from "@/actions/companies";
import { getIndustries } from "@/actions/industries";
import { getReferrals } from "@/actions/referrals";
import { notFound } from "next/navigation";
import { CompanyDetailClient } from "./company-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const [company, industries, referrals] = await Promise.all([
    getCompany(id),
    getIndustries(),
    getReferrals(),
  ]);
  if (!company) notFound();
  return (
    <CompanyDetailClient
      company={company}
      industries={industries}
      referrals={referrals}
    />
  );
}
