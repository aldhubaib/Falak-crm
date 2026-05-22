import { getInvoice } from "@/actions/invoices";
import { notFound } from "next/navigation";
import { InvoiceDetailClient } from "./invoice-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  return <InvoiceDetailClient invoice={invoice} />;
}
