"use client";

import { useState } from "react";
import { addCurrency, removeCurrency, setExchangeRate, setBaseCurrency } from "@/actions/currencies";
import { AVAILABLE_CURRENCIES } from "@/lib/currency";
import { ArrowLeft, Plus, Trash2, Star, ArrowRightLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";

type CurrencyItem = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  active: boolean;
};

type LatestRates = Record<string, { rate: number; date: Date } | null>;

export function CurrenciesClient({
  currencies,
  latestRates,
  baseCurrency,
}: {
  currencies: CurrencyItem[];
  latestRates: LatestRates;
  baseCurrency: string;
}) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [showAdd, setShowAdd] = useState(false);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const unusedCurrencies = AVAILABLE_CURRENCIES.filter(
    (c) => !currencies.some((existing) => existing.code === c.code)
  );

  const handleAdd = async (code: string, name: string, symbol: string) => {
    const result = await addCurrency(code, name, symbol);
    if (!result.ok) { pushError(result.error); return; }
    setShowAdd(false);
    router.refresh();
  };

  const handleRemove = async (id: string) => {
    const result = await removeCurrency(id);
    if (!result.ok) { pushError(result.error); return; }
    router.refresh();
  };

  const handleSetBase = async (code: string) => {
    const result = await setBaseCurrency(code);
    if (!result.ok) { pushError(result.error); return; }
    router.refresh();
  };

  const handleSaveRate = async (code: string) => {
    const value = parseFloat(rateInputs[code]);
    if (isNaN(value) || value <= 0) return;
    setSaving(code);
    const result = await setExchangeRate(code, value);
    setSaving(null);
    if (!result.ok) { pushError(result.error); return; }
    setRateInputs((prev) => ({ ...prev, [code]: "" }));
    router.refresh();
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">Currencies</h1>
        <Button onClick={() => setShowAdd(true)} disabled={unusedCurrencies.length === 0}>
          <Plus className="w-3.5 h-3.5" />
          Add Currency
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-3.5 h-3.5 text-amber-500" />
          <p className="text-[12px] font-medium text-foreground">Base Currency: {baseCurrency}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          All values are converted to {baseCurrency} for reporting. Set exchange rates manually below.
        </p>
      </div>

      {/* Currencies list */}
      <div className="space-y-3">
        {currencies.map((currency) => (
          <div key={currency.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[14px] font-semibold text-foreground">
                {currency.symbol}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-foreground">{currency.code}</p>
                  {currency.isBase && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
                      BASE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{currency.name}</p>
              </div>
              {!currency.isBase && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSetBase(currency.code)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                    title="Set as base currency"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemove(currency.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove currency"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Exchange rate section for non-base currencies */}
            {!currency.isBase && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">
                    1 {currency.code} = {latestRates[currency.code]
                      ? `${latestRates[currency.code]!.rate} ${baseCurrency}`
                      : "Not set"}
                  </p>
                  {latestRates[currency.code] && (
                    <span className="text-[10px] text-muted-foreground">
                      (set {new Date(latestRates[currency.code]!.date).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">1 {currency.code} =</span>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="Rate"
                      value={rateInputs[currency.code] || ""}
                      onChange={(e) => setRateInputs((prev) => ({ ...prev, [currency.code]: e.target.value }))}
                      className="flex-1 h-8 px-3 rounded-lg border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[11px] text-muted-foreground">{baseCurrency}</span>
                  </div>
                  <button
                    onClick={() => handleSaveRate(currency.code)}
                    disabled={!rateInputs[currency.code] || saving === currency.code}
                    className="h-8 px-3 rounded-lg border border-border text-[11px] font-medium text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    {saving === currency.code ? "..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {currencies.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground mb-2">No currencies configured.</p>
          <p className="text-[11px] text-muted-foreground">Add your base currency (KWD) first, then add others.</p>
        </div>
      )}

      {/* Add currency modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowAdd(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[101]">
            <div className="mx-4 bg-background border border-border rounded-xl shadow-2xl p-5">
              <h3 className="text-[14px] font-semibold text-foreground mb-4">Add Currency</h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {unusedCurrencies.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleAdd(c.code, c.name, c.symbol)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[12px] font-semibold">
                      {c.symbol}
                    </span>
                    <div>
                      <p className="text-[13px] text-foreground font-medium">{c.code}</p>
                      <p className="text-[11px] text-muted-foreground">{c.name}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAdd(false)}
                  className="h-9 px-4 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
