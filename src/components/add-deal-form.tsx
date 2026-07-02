"use client";

import { useState } from "react";
import { createDeal } from "@/actions/deals";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";
import { Plus, X, Loader2 } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";

interface AddDealFormProps {
  companyId?: string;
  contactId?: string;
  contacts?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function AddDealForm({ companyId, contactId, contacts, onSuccess }: AddDealFormProps) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [open, setOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(contactId || "");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-icon-sm h-icon-sm" />
        New Deal
      </Button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        const formData = new FormData(e.currentTarget);
        if (companyId) formData.set("companyId", companyId);
        formData.set("contactId", selectedContactId);
        const result = await createDeal(formData);
        if (!result.ok) { pushError(result.error); setSaving(false); return; }
        setOpen(false);
        setSaving(false);
        setSelectedContactId(contactId || "");
        onSuccess?.();
        router.refresh();
      }}
      className="rounded-lg border border-border p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sub font-medium text-foreground">New Deal</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            name="title"
            placeholder="Deal title"
            required
            autoFocus
            className="w-full h-input bg-transparent border-none text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
        <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">Value</label>
          <input
            name="value"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="w-full h-input bg-transparent border-none text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      {contacts && contacts.length > 0 && (
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
          <FormSelect
            name="contactId"
            label="Contact"
            value={selectedContactId}
            placeholder="None"
            options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setSelectedContactId}
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {saving ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}
