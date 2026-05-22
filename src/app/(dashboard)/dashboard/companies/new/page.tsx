import { getIndustries } from "@/actions/industries";
import { NewCompanyClient } from "./new-company-client";

export default async function NewCompanyPage() {
  const industries = await getIndustries();
  return <NewCompanyClient industries={industries.map((i) => ({ id: i.id, name: i.name }))} />;
}
