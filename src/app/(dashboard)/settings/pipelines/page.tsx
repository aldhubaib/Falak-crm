import { getPipelines } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { PipelinesClient } from "./pipelines-client";

export default async function PipelinesPage() {
  const pipelines = await getPipelines();

  return (
    <>
      <AppHeader title="Pipelines & Stages" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PipelinesClient pipelines={pipelines} />
      </main>
    </>
  );
}
