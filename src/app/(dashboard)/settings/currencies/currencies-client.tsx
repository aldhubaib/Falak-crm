"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Trash2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import {
  addCurrency,
  removeCurrency,
  setBaseCurrency,
  setExchangeRate,
} from "@/actions/currencies";

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  active: boolean;
};

type Rates = Record<string, { rate: number; date: Date } | null>;

export function CurrenciesClient({
  currencies,
  rates,
  baseCode,
}: {
  currencies: Currency[];
  rates: Rates;
  baseCode: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");

  const handleAdd = () => {
    if (!code.trim() || !name.trim() || !symbol.trim()) return;
    startTransition(async () => {
      await addCurrency(code.trim().toUpperCase(), name.trim(), symbol.trim());
      setAddOpen(false);
      setCode("");
      setName("");
      setSymbol("");
      router.refresh();
    });
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      await removeCurrency(id);
      router.refresh();
    });
  };

  const handleSetBase = (currencyCode: string) => {
    startTransition(async () => {
      await setBaseCurrency(currencyCode);
      router.refresh();
    });
  };

  const handleSetRate = (fromCurrency: string, rate: string) => {
    const num = parseFloat(rate);
    if (isNaN(num) || num <= 0) return;
    startTransition(async () => {
      await setExchangeRate(fromCurrency, num);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-5xl">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span>
            Base Currency:{" "}
            <span className="text-foreground">{baseCode || "—"}</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          All values are converted to {baseCode || "the base currency"} for
          reporting. Set exchange rates manually below.
        </p>
      </div>

      <div className="space-y-field-gap">
        {currencies.map((c) => (
          <SurfaceCard
            key={c.id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted/50 text-xs font-bold text-foreground">
                {c.symbol}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.code}</span>
                  {c.isBase && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-amber-400">
                      Base
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!c.isBase && (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRightLeft className="h-3 w-3" />
                    <span>1 {c.code} =</span>
                    <RateInput
                      defaultValue={rates[c.code]?.rate ?? 0}
                      onSave={(val) => handleSetRate(c.code, val)}
                      disabled={pending}
                    />
                    <span>{baseCode}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleSetBase(c.code)}
                    disabled={pending}
                  >
                    Set as base
                  </Button>
                </>
              )}
              {!c.isBase && (
                <IconButton
                  aria-label="Remove currency"
                  onClick={() => handleRemove(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </div>
          </SurfaceCard>
        ))}

        {currencies.length === 0 && <EmptyState message="No currencies yet." />}

        <button
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border/60 py-3 text-sm text-muted-foreground hover:border-border hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add currency
        </button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Currency</DialogTitle>
            <DialogDescription>
              Enter the currency code, name, and symbol.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Code (e.g. USD)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={3}
            />
            <Input
              placeholder="Name (e.g. US Dollar)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Symbol (e.g. $)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              maxLength={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={pending}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function RateInput({
  defaultValue,
  onSave,
  disabled,
}: {
  defaultValue: number;
  onSave: (val: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState(defaultValue > 0 ? String(defaultValue) : "");

  return (
    <Input
      type="number"
      step="0.0001"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value && parseFloat(value) !== defaultValue) onSave(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSave(value);
      }}
      className="h-7 w-20 text-xs"
      disabled={disabled}
    />
  );
}
