"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { stopTestRole, stopImpersonation } from "@/actions/team";
import type { ViewAsState } from "@/lib/workspace";

// Floating pill shown while an owner is viewing the app as someone else —
// either testing a role (Settings → Roles → Test role) or logged in as a
// member (Settings → Team → Log in as). State comes from the server layout,
// so it appears/disappears immediately on router.refresh.
export function ViewAsBanner({ viewAs }: { viewAs: NonNullable<ViewAsState> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const exit = () => {
    startTransition(async () => {
      if (viewAs.kind === "member") await stopImpersonation();
      else await stopTestRole();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-4">
      <div className="flex items-center gap-3 rounded-full border border-warning/40 bg-background/95 py-1.5 pl-4 pr-1.5 text-sm shadow-lg backdrop-blur">
        <Eye className="h-4 w-4 text-warning" />
        <span>
          {viewAs.kind === "member" ? "Viewing as" : "Testing role"}{" "}
          <span className="font-medium">{viewAs.name}</span>
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
