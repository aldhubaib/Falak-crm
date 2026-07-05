"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { stopTestRole } from "@/actions/team";

// Shown while an owner is previewing the app through another role (started
// from Settings → Roles → Play). Without it there'd be no way to tell test
// mode is on — the cookie lasts an hour.
export function TestRoleBanner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roleName, setRoleName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/test-role")
      .then((r) => (r.ok ? r.json() : { roleName: null }))
      .then((data) => {
        if (active) setRoleName(data?.roleName ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!roleName) return null;

  const exit = () => {
    startTransition(async () => {
      await stopTestRole();
      setRoleName(null);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-warning/40 bg-background/95 py-1.5 pl-4 pr-1.5 text-sm shadow-lg backdrop-blur">
        <Eye className="h-4 w-4 text-warning" />
        <span>
          Testing role <span className="font-medium">{roleName}</span>
        </span>
        <button
          type="button"
          onClick={exit}
          disabled={pending}
          className="flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/25 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Exit
        </button>
      </div>
    </div>
  );
}
