"use client";

import { useState } from "react";
import { createInvoice } from "@/actions/invoices";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";

export function NewInvoiceClient({
  projects,
  contacts,
}: {
  projects: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [projectId, setProjectId] = useState("");
  const [contactId, setContactId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-8">
        <Link
          href="/invoices"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">New Invoice</h1>
        <Button type="submit" form="invoice-form" disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <form
        id="invoice-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          setSaving(true);
          const formData = new FormData();
          if (projectId) formData.set("projectId", projectId);
          if (contactId) formData.set("contactId", contactId);
          formData.set("description", description || "Item");
          formData.set("quantity", quantity || "1");
          formData.set("unitPrice", unitPrice || "0");
          const result = await createInvoice(formData);
          if (result.ok) {
            router.push(`/invoices/${result.data.id}`);
          } else {
            pushError(result.error);
            setSaving(false);
          }
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComboboxField
            label="Project"
            value={projectId}
            options={projects.map((p) => ({ id: p.id, label: p.name }))}
            placeholder="Optional — link to a project"
            selectById
            onSelect={(val) => setProjectId(val)}
          />
          <ComboboxField
            label="Contact"
            value={contactId}
            options={contacts.map((c) => ({ id: c.id, label: c.name }))}
            placeholder="Select contact..."
            selectById
            onSelect={(val) => setContactId(val)}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">Line Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-background border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Item description"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <div className="rounded-lg bg-background border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground focus:outline-none"
              />
            </div>
            <div className="rounded-lg bg-background border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Unit Price</label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                step="0.01"
                placeholder="0.00"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          </div>
          {unitPrice && (
            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              <p className="text-[13px] text-foreground">
                Total: <span className="font-semibold">{((parseInt(quantity) || 1) * (parseFloat(unitPrice) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
