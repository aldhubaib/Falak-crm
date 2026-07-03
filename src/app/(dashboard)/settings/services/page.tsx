import { getServices } from "@/actions/services";
import { AppHeader } from "@/components/app-header";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <>
      <AppHeader title="Services" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ServicesClient services={services} />
      </main>
    </>
  );
}
