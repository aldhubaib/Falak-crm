import { getCurrencies, getLatestRates, getExchangeRates, getWorkspaceCurrency } from "@/actions/currencies";
import { CurrenciesClient } from "./currencies-client";

export default async function CurrenciesPage() {
  const [currencies, latestRates, rateHistory, workspace] = await Promise.all([
    getCurrencies(),
    getLatestRates(),
    getExchangeRates(),
    getWorkspaceCurrency(),
  ]);

  return (
    <CurrenciesClient
      currencies={currencies}
      latestRates={latestRates}
      rateHistory={rateHistory.map((r) => ({
        id: r.id,
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: Number(r.rate),
        effectiveDate: r.effectiveDate,
      }))}
      baseCurrency={workspace.baseCurrency}
    />
  );
}
