import { getServices } from "@/actions/services";
import { ServicesListClient } from "./services-list-client";

export default async function ServicesSettingsPage() {
  const services = await getServices();
  return <ServicesListClient services={JSON.parse(JSON.stringify(services))} />;
}
