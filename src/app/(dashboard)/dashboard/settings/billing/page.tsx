import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function BillingSettingsPage() {
  const workspace = await requireWorkspace();

  async function updateBilling(formData: FormData) {
    "use server";
    const ws = await requireWorkspace();
    const taxRate = parseFloat(formData.get("taxRate") as string);
    await db.workspace.update({
      where: { id: ws.id },
      data: { taxRate },
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
          <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Base Currency</label>
            <p className="text-[13px] text-foreground font-medium h-8 flex items-center">{workspace.baseCurrency}</p>
            <p className="text-[11px] text-muted-foreground">
              Manage currencies in{" "}
              <Link href="/dashboard/settings/currencies" className="text-primary no-underline hover:underline">
                Settings → Currencies
              </Link>
            </p>
          </div>
          <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tax Rate (%)</label>
            <input
              name="taxRate"
              type="number"
              step="0.01"
              defaultValue={Number(workspace.taxRate)}
              className="w-full h-8 bg-transparent border-none text-[13px] text-foreground focus:outline-none"
            />
          </div>
          <Button type="submit">
            Save Changes
          </Button>
        </form>
      </div>
    </div>
  );
}
