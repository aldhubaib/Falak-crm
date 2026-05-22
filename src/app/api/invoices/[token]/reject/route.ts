import { rejectInvoice } from "@/actions/invoices";
import { redirect } from "next/navigation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formData = await request.formData().catch(() => null);
  const reason = formData?.get("reason") as string | null;
  await rejectInvoice(token, reason ?? undefined);
  redirect(`/inv/${token}`);
}
