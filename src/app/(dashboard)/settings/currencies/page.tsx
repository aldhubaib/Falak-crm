import { getCurrencies, getLatestRates } from "@/actions/currencies";
import { AppHeader } from "@/components/app-header";
import { CurrenciesClient } from "./currencies-client";

export default async function CurrenciesPage() {
  const [currencies, rates] = await Promise.all([
    getCurrencies(),
    getLatestRates(),
  ]);

  const base = currencies.find((c) => c.isBase);

  return (
    <>
      <AppHeader title="Currencies" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <CurrenciesClient
          currencies={currencies}
          rates={rates}
          baseCode={base?.code ?? ""}
        />
      </main>
    </>
  );
}
