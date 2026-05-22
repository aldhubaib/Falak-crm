import { getCurrencies, getLatestRates, getWorkspaceCurrency } from "@/actions/currencies";
import { CurrenciesClient } from "./currencies-client";

export default async function CurrenciesPage() {
  const [currencies, latestRates, workspace] = await Promise.all([
    getCurrencies(),
    getLatestRates(),
    getWorkspaceCurrency(),
  ]);

  return (
    <CurrenciesClient
      currencies={currencies}
      latestRates={latestRates}
      baseCurrency={workspace.baseCurrency}
    />
  );
}
