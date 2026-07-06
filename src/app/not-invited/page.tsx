"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ShieldX } from "lucide-react";

// Shown to accounts that signed in with Google but were never added to the
// team. The workspace is invite-only — there is nothing else they can reach.
export default function NotInvitedPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-[400px] text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.08]">
          <ShieldX className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="mt-6 text-[24px] font-semibold leading-tight tracking-tight">
          You&apos;re not on the team yet
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          This workspace is invite-only.
          {email && (
            <>
              {" "}
              <span className="text-white/80">{email}</span> hasn&apos;t been
              added by an admin.
            </>
          )}{" "}
          Ask your admin to add you from Settings → Team, then sign in again.
        </p>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="mt-8 h-11 w-full rounded-lg bg-white/[0.08] px-5 text-[14px] font-medium text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
