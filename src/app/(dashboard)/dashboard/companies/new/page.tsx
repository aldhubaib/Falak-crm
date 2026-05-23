import { currentUser } from "@clerk/nextjs/server";
import { getIndustries } from "@/actions/industries";
import { getReferrals } from "@/actions/referrals";
import { NewCompanyClient } from "./new-company-client";

export default async function NewCompanyPage() {
  const [industries, referrals, user] = await Promise.all([
    getIndustries(),
    getReferrals(),
    currentUser(),
  ]);
  return (
    <NewCompanyClient
      industries={industries.map((i) => ({ id: i.id, name: i.name }))}
      referrals={referrals.map((r) => ({ id: r.id, name: r.name }))}
      currentUserName={user?.fullName || user?.firstName || "Unknown"}
    />
  );
}
