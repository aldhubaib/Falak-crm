import { getTeamMembers } from "@/actions/team";
import { getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const [{ roles, members }, statuses] = await Promise.all([
    getTeamMembers(),
    getTaskStatuses(),
  ]);

  return (
    <>
      <AppHeader title="Roles" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <RolesClient
          roles={roles}
          // "Published" is hidden everywhere (board, task moves) — no point
          // configuring stage permissions for it.
          stages={statuses
            .filter((s) => s.name !== "Published")
            .map((s) => ({ id: s.id, name: s.name, order: s.order }))}
          memberCounts={countByRole(roles, members)}
        />
      </main>
    </>
  );
}

function countByRole(
  roles: { id: string }[],
  members: { role: { id: string } | null }[],
) {
  const counts: Record<string, number> = {};
  for (const r of roles) counts[r.id] = 0;
  for (const m of members) {
    if (m.role) counts[m.role.id] = (counts[m.role.id] ?? 0) + 1;
  }
  return counts;
}
