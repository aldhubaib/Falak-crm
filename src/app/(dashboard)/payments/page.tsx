import Link from "next/link";
import { Plus } from "lucide-react";
import { getPayments } from "@/actions/payments";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { getInvoiceLogoUrl } from "@/lib/branding";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { PaymentsClient } from "./payments-client";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const [payments, { member }, logoUrl, { open }] = await Promise.all([
    getPayments(),
    requireWorkspaceWithMember(),
    getInvoiceLogoUrl(),
    searchParams,
  ]);
  const editable = canEdit(member, "payments");

  return (
    <>
      <AppHeader
        title="Payments Received"
        actions={
          editable ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/payments/new">
                <Plus className="h-4 w-4" />
                Record Payment
              </Link>
            </Button>
          ) : undefined
        }
      />
      <PaymentsClient
        payments={payments}
        editable={editable}
        logoUrl={logoUrl}
        initialOpenId={open ?? null}
      />
    </>
  );
}
