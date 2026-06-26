import { currentUser } from "@clerk/nextjs/server";
import { getCompanies } from "@/actions/companies";
import { NewContactClient } from "./new-contact-client";

export default async function NewContactPage() {
  const [companies, user] = await Promise.all([getCompanies(), currentUser()]);
  return (
    <NewContactClient
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      currentUserName={user?.fullName || user?.firstName || "Unknown"}
    />
  );
}
