"use client";

import { useState } from "react";
import { createReferral, deleteReferral } from "@/actions/referrals";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Referral = { id: string; name: string; order: number };

export function ReferralsClient({ referrals: initial }: { referrals: Referral[] }) {
  const [referrals, setReferrals] = useState(initial);
  const [newName, setNewName] = useState("");

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Referrals</h1>
      </div>

      <div className="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            const referral = await createReferral(newName.trim());
            setReferrals((prev) => [...prev, referral]);
            setNewName("");
          }}
          className="flex items-center gap-2 mb-6"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New referral source..."
            className="flex-1 h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
          />
          <Button type="submit" disabled={!newName.trim()}>
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </form>

        {referrals.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No referral sources yet. Add one above.</p>
        ) : (
          <div className="space-y-1">
            {referrals.map((referral) => (
              <div
                key={referral.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-card transition-colors group"
              >
                <span className="text-[13px] text-foreground">{referral.name}</span>
                <button
                  onClick={async () => {
                    await deleteReferral(referral.id);
                    setReferrals((prev) => prev.filter((r) => r.id !== referral.id));
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
