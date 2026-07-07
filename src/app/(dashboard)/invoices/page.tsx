import Link from "next/link";
import { Plus } from "lucide-react";
import { getInvoices } from "@/actions/invoices";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { getInvoiceLogoUrl } from "@/lib/branding";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const [invoices, { member }, logoUrl] = await Promise.all([
    getInvoices(),
    requireWorkspaceWithMember(),
    getInvoiceLogoUrl(),
  ]);
  const editable = canEdit(member, "invoices");

  return (
    <>
      <AppHeader
        title="Invoices"
        actions={
          editable ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/invoices/new">
                <Plus className="h-4 w-4" />
                New Invoice
              </Link>
            </Button>
          ) : undefined
        }
      />
      <InvoicesClient invoices={invoices} editable={editable} logoUrl={logoUrl} />
    </>
  );
}
