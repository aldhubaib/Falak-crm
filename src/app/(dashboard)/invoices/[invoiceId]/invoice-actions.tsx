"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/surface-card";
import { sendInvoice, markInvoicePaid } from "@/actions/invoices";

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSend = () => {
    startTransition(async () => {
      await sendInvoice(invoiceId);
      router.refresh();
    });
  };

  const handlePaid = () => {
    startTransition(async () => {
      await markInvoicePaid(invoiceId);
      router.refresh();
    });
  };

  if (status === "PAID") return null;

  return (
    <SurfaceCard className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" onClick={handleSend} disabled={pending}>
          <Send className="h-3.5 w-3.5" />
          Send Invoice
        </Button>
      )}
      {(status === "SENT" || status === "ACCEPTED") && (
        <Button size="sm" onClick={handlePaid} disabled={pending}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark as Paid
        </Button>
      )}
      {status === "SENT" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSend}
          disabled={pending}
        >
          <Send className="h-3.5 w-3.5" />
          Resend
        </Button>
      )}
    </SurfaceCard>
  );
}
