"use client";

import { useState, useEffect } from "react";
import { stopTestRole } from "@/actions/team";
import { Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";

export function TestRoleBanner() {
  const router = useRouter();
  const [roleName, setRoleName] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    fetch("/api/test-role")
      .then((r) => r.json())
      .then((data) => {
        if (data.roleName) setRoleName(data.roleName);
      })
      .catch(() => {});
  }, []);

  if (!roleName) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
      <Play className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-secondary text-amber-400 flex-1">
        Testing as <span className="font-semibold text-foreground">{roleName}</span>
      </span>
      <button
        onClick={async () => {
          setStopping(true);
          await stopTestRole();
          setRoleName(null);
          router.refresh();
        }}
        disabled={stopping}
        className="flex items-center gap-1 text-secondary font-medium text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 rounded-lg transition-colors shrink-0 min-h-touch"
      >
        <Square className="w-3 h-3" />
        {stopping ? "Stopping..." : "Stop"}
      </button>
    </div>
  );
}
