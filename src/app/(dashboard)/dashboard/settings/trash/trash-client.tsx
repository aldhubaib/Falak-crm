"use client";

import { useState } from "react";
import { restoreRecord } from "@/actions/delete";
import { type EntityType } from "@/lib/soft-delete";
import { ArrowLeft, RotateCcw, Building2, User, Handshake, FolderKanban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TrashItem = {
  id: string;
  type: EntityType;
  name: string;
  deletedAt: Date;
};

const typeIcons: Record<EntityType, typeof Building2> = {
  company: Building2,
  contact: User,
  deal: Handshake,
  project: FolderKanban,
};

const typeLabels: Record<EntityType, string> = {
  company: "Company",
  contact: "Contact",
  deal: "Deal",
  project: "Project",
};

export function TrashClient({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleRestore = async (type: EntityType, id: string) => {
    setRestoring(id);
    await restoreRecord(type, id);
    setRestoring(null);
    router.refresh();
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Trash</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Trash2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">Trash is empty.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Deleted</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const Icon = typeIcons[item.type];
                return (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground uppercase">{typeLabels[item.type]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground">{item.name}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                      {new Date(item.deletedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        size="sm"
                        onClick={() => handleRestore(item.type, item.id)}
                        disabled={restoring === item.id}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {restoring === item.id ? "..." : "Restore"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
