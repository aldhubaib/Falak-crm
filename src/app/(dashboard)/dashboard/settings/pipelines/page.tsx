import { getPipelines } from "@/actions/settings";
import { PipelinesClient } from "./pipelines-client";

export default async function PipelinesSettingsPage() {
  const pipelines = await getPipelines();
  return <PipelinesClient pipelines={pipelines} />;
}
