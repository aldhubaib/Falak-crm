import { getIndustries } from "@/actions/industries";
import { IndustriesClient } from "./industries-client";

export default async function IndustriesSettingsPage() {
  const industries = await getIndustries();
  return <IndustriesClient industries={industries} />;
}
