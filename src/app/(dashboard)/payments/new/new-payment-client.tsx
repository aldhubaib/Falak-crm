"use client";

// Record Payment form matching the Lovable design: invoice picker with the
// outstanding balance hint, payment number/date, type, mode, reference,
// location, amount and notes. Also drives the edit flow (`?edit=`).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import {
  createPayment,
  updatePayment,
  type PaymentInput,
} from "@/actions/payments";

const MODES = ["Cash", "Check", "Bank Transfer", "Credit Card", "Other"];
const TYPES = ["Invoice Payment", "Retainer", "Advance"];

type InvoiceOption = {
  id: string;
  number: string;
  clientName: string;
  currency: string;
  total: number;
  paid: number;
};

export type PaymentFormInitial = {
  number: string;
  invoiceId: string;
  date: string; // yyyy-mm-dd
  location: string;
  type: string;
  mode: string;
  referenceNumber: string;
  amount: number;
  notes: string;
};

function formatMoney(currency: string, amount: number): string {
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

export function NewPaymentClient({
  nextNumber,
  invoices,
  preselectInvoiceId,
  paymentId,
  initial,
}: {
  nextNumber: string;
  invoices: InvoiceOption[];
  /** From `?invoice=` — preselects the invoice when recording from its preview. */
  preselectInvoiceId?: string;
  /** When set, the form edits this payment instead of creating a new one. */
  paymentId?: string;
  initial?: PaymentFormInitial;
}) {
  const router = useRouter();
  const isEdit = !!paymentId;

  const [number, setNumber] = useState(initial?.number ?? nextNumber);
  const [invoiceId, setInvoiceId] = useState(
    initial?.invoiceId ??
      (preselectInvoiceId && invoices.some((i) => i.id === preselectInvoiceId)
        ? preselectInvoiceId
        : ""),
  );
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [type, setType] = useState(initial?.type ?? "Invoice Payment");
  const [mode, setMode] = useState(initial?.mode ?? "Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState(
    initial?.referenceNumber ?? "",
  );
  const [location, setLocation] = useState(initial?.location ?? "Kuwait");
  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId],
  );
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [invalid, setInvalid] = useState<{ invoice?: boolean; amount?: boolean }>({});

  const { execute: submit, loading: saving } = useAction(
    (input: PaymentInput) =>
      paymentId ? updatePayment(paymentId, input) : createPayment(input),
  );

  const currency = selectedInvoice?.currency ?? "KWD";
  const amountNum = Number(amount) || 0;
  const balance = selectedInvoice
    ? Math.max(0, selectedInvoice.total - selectedInvoice.paid)
    : 0;

  const pickInvoice = (id: string) => {
    setInvoiceId(id);
    setInvalid((v) => ({ ...v, invoice: false }));
    if (!amount) {
      const inv = invoices.find((i) => i.id === id);
      if (inv) setAmount(String(Math.max(0, inv.total - inv.paid)));
    }
  };

  const save = async () => {
    const bad = { invoice: !invoiceId, amount: !(amountNum > 0) };
    setInvalid(bad);
    if (bad.invoice || bad.amount) return;

    const result = await submit({
      invoiceId,
      number,
      date,
      location: location || undefined,
      type,
      mode,
      referenceNumber: referenceNumber || undefined,
      amount: amountNum,
      notes: notes || undefined,
    });
    if (result) router.push("/payments");
  };

  return (
    <>
      <AppHeader
        title={isEdit ? "Edit Payment" : "Record Payment"}
        backHref="/payments"
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-5 rounded-xl border border-border/60 bg-surface p-4 sm:p-6">
            <Field label="Invoice" required>
              <Select value={invoiceId} onValueChange={pickInvoice}>
                <SelectTrigger
                  aria-invalid={invalid.invoice || undefined}
                  className={cn(
                    "w-full",
                    invalid.invoice &&
                      "border-destructive focus-visible:ring-destructive/30",
                  )}
                >
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.number} — {inv.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {invalid.invoice && (
                <p className="mt-1.5 text-xs text-destructive">
                  Select an invoice.
                </p>
              )}
              {selectedInvoice && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Invoice total:{" "}
                  {formatMoney(selectedInvoice.currency, selectedInvoice.total)}
                  {selectedInvoice.paid > 0 && (
                    <>
                      {" "}
                      · Balance due: {formatMoney(selectedInvoice.currency, balance)}
                    </>
                  )}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Payment #">
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </Field>
              <Field label="Payment Date">
                <div className="relative">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-60"
                  />
                </div>
              </Field>

              <Field label="Type">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Payment Mode">
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Reference Number">
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="CLG.CHQ.NO. 1234"
                />
              </Field>

              <Field label="Location">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </Field>

              <Field label={`Amount (${currency})`} required>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={amount}
                  aria-invalid={invalid.amount || undefined}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setInvalid((v) => ({ ...v, amount: false }));
                  }}
                  className={cn(
                    invalid.amount &&
                      "border-destructive focus-visible:ring-destructive/30",
                  )}
                />
                {invalid.amount && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Enter an amount greater than zero.
                  </p>
                )}
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional"
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => router.push("/payments")}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full"
                disabled={saving}
                onClick={save}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Record Payment"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
