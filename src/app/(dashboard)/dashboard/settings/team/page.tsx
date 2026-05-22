import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

export default async function TeamSettingsPage() {
  const workspace = await requireWorkspace();
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { role: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Team & Roles</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[13px] font-medium text-foreground mb-4">Members ({members.length})</h3>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary">
                {(member.name || member.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-[13px] text-foreground">{member.name || member.email}</p>
                <p className="text-[11px] text-muted-foreground">{member.email}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                member.type === "OWNER" ? "bg-primary/15 text-primary" :
                member.type === "FREELANCER" ? "bg-purple/15 text-purple" :
                "bg-muted text-muted-foreground"
              }`}>
                {member.type.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
