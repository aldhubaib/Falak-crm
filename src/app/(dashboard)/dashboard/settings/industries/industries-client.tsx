"use client";

import { useState } from "react";
import { createIndustry, deleteIndustry } from "@/actions/industries";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";

type Industry = { id: string; name: string; order: number };

export function IndustriesClient({ industries: initial }: { industries: Industry[] }) {
  const [industries, setIndustries] = useState(initial);
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
        <h1 className="text-lg font-semibold text-foreground">Industries</h1>
      </div>

      <div className="max-w-md">
        {/* Add new */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            const industry = await createIndustry(newName.trim());
            setIndustries((prev) => [...prev, industry]);
            setNewName("");
          }}
          className="flex items-center gap-2 mb-6"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New industry name..."
            className="flex-1 h-10 px-3 rounded-lg bg-transparent border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </form>

        {/* List */}
        {industries.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No industries yet. Add one above.</p>
        ) : (
          <div className="space-y-1">
            {industries.map((industry) => (
              <div
                key={industry.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-card transition-colors group"
              >
                <span className="text-[13px] text-foreground">{industry.name}</span>
                <button
                  onClick={async () => {
                    await deleteIndustry(industry.id);
                    setIndustries((prev) => prev.filter((i) => i.id !== industry.id));
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
