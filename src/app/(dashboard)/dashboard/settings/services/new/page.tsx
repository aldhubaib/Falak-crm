import { currentUser } from "@clerk/nextjs/server";
import { NewServiceClient } from "./new-service-client";

export default async function NewServicePage() {
  const user = await currentUser();
  const currentUserName = user?.fullName || user?.firstName || "Unknown";

  return <NewServiceClient currentUserName={currentUserName} />;
}
