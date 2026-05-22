import { getReferrals } from "@/actions/referrals";
import { ReferralsClient } from "./referrals-client";

export default async function ReferralsSettingsPage() {
  const referrals = await getReferrals();
  return <ReferralsClient referrals={referrals} />;
}
