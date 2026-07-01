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
    revalidatePath("/settings/billing");
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/settings"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-icon-sm h-icon-sm" />
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 max-w-md">
        <form action={updateBilling} className="space-y-4">
          <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5">
            <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">Base Currency</label>
            <p className="text-body text-foreground font-medium h-8 flex items-center">{workspace.baseCurrency}</p>
            <p className="text-sub text-muted-foreground">
              Manage currencies in{" "}
              <Link href="/settings/currencies" className="text-primary no-underline hover:underline">
                Settings → Currencies
              </Link>
            </p>
          </div>
          <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-label font-medium text-muted-foreground uppercase tracking-wider">Tax Rate (%)</label>
            <input
              name="taxRate"
              type="number"
              step="0.01"
              defaultValue={Number(workspace.taxRate)}
              className="w-full h-input bg-transparent border-none text-body text-foreground focus:outline-none"
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
