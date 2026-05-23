import { getPipeline } from "@/actions/deals";
import { DealsClient } from "./deals-client";

export default async function DealsPage() {
  const pipeline = await getPipeline();

  return <DealsClient pipeline={pipeline} />;
}

