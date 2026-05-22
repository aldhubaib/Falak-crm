import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function BillingSettingsPage() {
  const workspace = await requireWorkspace();

  async function updateBilling(formData: FormData) {
    "use server";
    const ws = await requireWorkspace();
    const currency = formData.get("currency") as string;
    const taxRate = parseFloat(formData.get("taxRate") as string);
    await db.workspace.update({
      where: { id: ws.id },
      data: { currency, taxRate },
    });
    revalidatePath("/dashboard/settings/billing");
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Billing Settings</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 max-w-md">
        <form action={updateBilling} className="space-y-4">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">Currency</label>
            <select
              name="currency"
              defaultValue={workspace.currency}
              className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground"
            >
              <option value="SAR">SAR — Saudi Riyal</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AED">AED — UAE Dirham</option>
              <option value="KWD">KWD — Kuwaiti Dinar</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">Tax Rate (%)</label>
            <input
              name="taxRate"
              type="number"
              step="0.01"
              defaultValue={Number(workspace.taxRate)}
              className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
