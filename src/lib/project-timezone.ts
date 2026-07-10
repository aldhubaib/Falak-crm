import { db } from "@/lib/db";
import { DEFAULT_PROJECT_TIMEZONE, normalizeTimezone } from "@/lib/timezone";

export async function getProjectTimezone(projectId: string): Promise<string> {
  const row = await db.project.findUnique({
    where: { id: projectId },
    select: { timezone: true },
  });
  return normalizeTimezone(row?.timezone);
}

export async function getProjectTimezones(
  projectIds: string[],
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, timezone: true },
  });
  return new Map(
    rows.map((r) => [r.id, normalizeTimezone(r.timezone)]),
  );
}

export { DEFAULT_PROJECT_TIMEZONE };
