"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/surface-card";
import { sendInvoice } from "@/actions/invoices";

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

  if (status === "PAID") return null;

  return (
    <SurfaceCard className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" onClick={handleSend} disabled={pending}>
          <Send className="h-3.5 w-3.5" />
          Send Invoice
        </Button>
      )}
      {(status === "SENT" || status === "ACCEPTED" || status === "PARTIAL") && (
        <Button
          size="sm"
          onClick={() => router.push(`/payments/new?invoice=${invoiceId}`)}
        >
          <Wallet className="h-3.5 w-3.5" />
          Record Payment
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
