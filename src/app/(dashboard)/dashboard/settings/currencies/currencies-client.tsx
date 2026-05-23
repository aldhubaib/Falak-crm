"use client";

import { useState } from "react";
import { addCurrency, removeCurrency, setExchangeRate, setBaseCurrency } from "@/actions/currencies";
import { AVAILABLE_CURRENCIES } from "@/lib/currency";
import { ArrowLeft, Plus, Trash2, Star, ArrowRightLeft, Check, Calendar, History, ChevronDown } from "lucide-react";
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

type RateHistoryItem = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: Date;
};

export function CurrenciesClient({
  currencies,
  latestRates,
  rateHistory,
  baseCurrency,
}: {
  currencies: CurrencyItem[];
  latestRates: LatestRates;
  rateHistory: RateHistoryItem[];
  baseCurrency: string;
}) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [showAdd, setShowAdd] = useState(false);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [dateInputs, setDateInputs] = useState<Record<string, string>>({});
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
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
    const effectiveDate = dateInputs[code] || undefined;
    setSaving(code);
    const result = await setExchangeRate(code, value, effectiveDate);
    setSaving(null);
    if (!result.ok) { pushError(result.error); return; }
    setRateInputs((prev) => ({ ...prev, [code]: "" }));
    setDateInputs((prev) => ({ ...prev, [code]: "" }));
    setEditingRate(null);
    router.refresh();
  };

  const startEditRate = (code: string) => {
    setRateInputs((prev) => ({ ...prev, [code]: "" }));
    setDateInputs((prev) => ({ ...prev, [code]: new Date().toISOString().split("T")[0] }));
    setEditingRate(code);
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
                {/* Current rate display */}
                {latestRates[currency.code] && (
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[12px] text-foreground font-medium">
                      1 {currency.code} = {latestRates[currency.code]!.rate} {baseCurrency}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      (effective {new Date(latestRates[currency.code]!.date).toLocaleDateString()})
                    </span>
                  </div>
                )}

                {/* Rate history */}
                {(() => {
                  const history = rateHistory.filter((r) => r.fromCurrency === currency.code);
                  if (history.length <= 1) return null;
                  return (
                    <div className="mb-3">
                      <button
                        onClick={() => setShowHistory(showHistory === currency.code ? null : currency.code)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <History className="w-3 h-3" />
                        <span>{history.length} rate entries</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showHistory === currency.code ? "rotate-180" : ""}`} />
                      </button>
                      {showHistory === currency.code && (
                        <div className="mt-2 rounded-lg border border-border bg-muted/20 overflow-hidden">
                          <div className="grid grid-cols-3 gap-2 px-3 py-1.5 border-b border-border">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Rate</span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Effective Date</span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Status</span>
                          </div>
                          {history.map((entry, idx) => (
                            <div key={entry.id} className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border last:border-0">
                              <span className="text-[12px] text-foreground">
                                {entry.rate} {baseCurrency}
                              </span>
                              <span className="text-[12px] text-muted-foreground">
                                {new Date(entry.effectiveDate).toLocaleDateString()}
                              </span>
                              <span className={`text-[10px] font-medium ${idx === 0 ? "text-green-400" : "text-muted-foreground"}`}>
                                {idx === 0 ? "Current" : "Historical"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Add new rate button or form */}
                {editingRate !== currency.code ? (
                  <button
                    onClick={() => startEditRate(currency.code)}
                    className="h-8 px-3 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    {latestRates[currency.code] ? "Add New Rate" : "Set Rate"}
                  </button>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">New Rate</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">1 {currency.code} =</span>
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        placeholder="Rate"
                        autoFocus
                        value={rateInputs[currency.code] || ""}
                        onChange={(e) => setRateInputs((prev) => ({ ...prev, [currency.code]: e.target.value }))}
                        className="flex-1 h-8 px-3 rounded-lg border border-border bg-black text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
                      />
                      <span className="text-[11px] text-muted-foreground">{baseCurrency}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Effective as of</span>
                      <input
                        type="date"
                        value={dateInputs[currency.code] || new Date().toISOString().split("T")[0]}
                        onChange={(e) => setDateInputs((prev) => ({ ...prev, [currency.code]: e.target.value }))}
                        className="flex-1 h-8 px-3 rounded-lg border border-border bg-black text-[12px] text-foreground focus:outline-none focus:border-ring transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        onClick={() => {
                          setEditingRate(null);
                          setRateInputs((prev) => ({ ...prev, [currency.code]: "" }));
                          setDateInputs((prev) => ({ ...prev, [currency.code]: "" }));
                        }}
                        className="h-8 px-3 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveRate(currency.code)}
                        disabled={!rateInputs[currency.code] || saving === currency.code}
                        className="h-8 px-3 rounded-full border border-border text-[11px] font-medium text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {saving === currency.code ? "Saving..." : "Save Rate"}
                      </button>
                    </div>
                  </div>
                )}
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
