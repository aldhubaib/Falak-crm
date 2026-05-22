import { acceptInvoice } from "@/actions/invoices";
import { redirect } from "next/navigation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await acceptInvoice(token);
  redirect(`/inv/${token}`);
}
