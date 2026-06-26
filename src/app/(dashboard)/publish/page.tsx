import { getPublishableProjects } from "@/actions/publish";
import { PublishClient } from "./publish-client";

export default async function PublishPage() {
  const projects = await getPublishableProjects();

  return <PublishClient projects={JSON.parse(JSON.stringify(projects))} />;
}
