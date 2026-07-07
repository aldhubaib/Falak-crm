import { getCompanies } from "@/actions/companies";
import { getIndustries } from "@/actions/industries";
import { getReferrals } from "@/actions/referrals";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { CompaniesClient } from "./companies-client";

export default async function CompaniesPage() {
  const [companies, industries, referrals, { member }] = await Promise.all([
    getCompanies(),
    getIndustries(),
    getReferrals(),
    requireWorkspaceWithMember(),
  ]);

  return (
    <>
      <AppHeader title="Companies" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CompaniesClient
          companies={companies.map((c) => ({
            id: c.id,
            name: c.name,
            nameAr: c.nameAr,
            industry: c.industry,
            referral: c.referral,
            website: c.website,
            countries: c.countries,
            logo: c.logo,
            createdAt: c.createdAt.toISOString(),
          }))}
          industries={industries.map((i) => i.name)}
          referrals={referrals.map((r) => r.name)}
          editable={canEdit(member, "companies")}
        />
      </main>
    </>
  );
}
