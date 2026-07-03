import Link from "next/link";
import { Plus } from "lucide-react";
import { getInvoices } from "@/actions/invoices";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { SurfaceCard } from "@/components/surface-card";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "outline",
  ACCEPTED: "default",
  REJECTED: "destructive",
  PAID: "default",
};

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <>
      <AppHeader
        title="Invoices"
        actions={
          <Button asChild size="sm" className="rounded-full">
            <Link href="/invoices/new">
              <Plus className="h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2 p-5">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}>
              <SurfaceCard className="flex items-center gap-3 transition-colors hover:border-border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {inv.number}
                    </span>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "secondary"}>
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {inv.project?.name ?? "No project"}
                    {inv.project?.company && ` — ${inv.project.company.name}`}
                    {inv.contact &&
                      ` • ${inv.contact.firstName} ${inv.contact.lastName}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {Number(inv.total).toLocaleString()}{" "}
                    <span className="text-xs text-muted-foreground">
                      {inv.currency}
                    </span>
                  </div>
                  <div className="text-tiny text-muted-foreground">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </SurfaceCard>
            </Link>
          ))}

          {invoices.length === 0 && (
            <EmptyState message="No invoices yet." />
          )}
        </div>
      </main>
    </>
  );
}
