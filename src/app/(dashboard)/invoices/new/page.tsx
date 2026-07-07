import { redirect } from "next/navigation";
import { getNewInvoiceData } from "@/actions/invoices";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { NewInvoiceClient } from "./new-invoice-client";

export default async function NewInvoicePage() {
  const [{ member }, data] = await Promise.all([
    requireWorkspaceWithMember(),
    getNewInvoiceData(),
  ]);
  if (!canEdit(member, "invoices")) redirect("/invoices");

  return (
    <NewInvoiceClient
      nextNumber={data.nextNumber}
      baseCurrency={data.baseCurrency}
      deals={data.deals}
      services={data.services}
      currencies={data.currencies}
    />
  );
}
