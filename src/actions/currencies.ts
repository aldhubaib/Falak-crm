"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

export async function getCurrencies() {
  const workspace = await requireWorkspace();
  return db.currency.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ isBase: "desc" }, { code: "asc" }],
  });
}

export async function addCurrency(code: string, name: string, symbol: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("Add Currency", async () => {
    const workspace = await requireWorkspace();

    const existing = await db.currency.findFirst({
      where: { workspaceId: workspace.id },
    });

    const currency = await db.currency.create({
      data: {
        workspaceId: workspace.id,
        code,
        name,
        symbol,
        isBase: !existing,
      },
    });

    revalidatePath("/dashboard/settings/currencies");
    return { id: currency.id };
  }, { code, name, symbol });
}

export async function removeCurrency(id: string): Promise<ActionResult> {
  return safeAction("Remove Currency", async () => {
    const workspace = await requireWorkspace();
    const currency = await db.currency.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (currency?.isBase) {
      throw new Error("Cannot remove the base currency");
    }

    await db.currency.delete({ where: { id } });
    await db.exchangeRate.deleteMany({
      where: { workspaceId: workspace.id, fromCurrency: currency!.code },
    });

    revalidatePath("/dashboard/settings/currencies");
  }, { currencyId: id });
}

export async function setBaseCurrency(code: string): Promise<ActionResult> {
  return safeAction("Set Base Currency", async () => {
    const workspace = await requireWorkspace();

    await db.currency.updateMany({
      where: { workspaceId: workspace.id },
      data: { isBase: false },
    });

    await db.currency.updateMany({
      where: { workspaceId: workspace.id, code },
      data: { isBase: true },
    });

    await db.workspace.update({
      where: { id: workspace.id },
      data: { baseCurrency: code },
    });

    revalidatePath("/dashboard/settings/currencies");
    revalidatePath("/dashboard");
  }, { code });
}

export async function getExchangeRates() {
  const workspace = await requireWorkspace();
  return db.exchangeRate.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { effectiveDate: "desc" },
  });
}

export async function getLatestRates() {
  const workspace = await requireWorkspace();
  const currencies = await db.currency.findMany({
    where: { workspaceId: workspace.id, isBase: false, active: true },
  });

  const rates: Record<string, { rate: number; date: Date } | null> = {};

  for (const curr of currencies) {
    const latest = await db.exchangeRate.findFirst({
      where: {
        workspaceId: workspace.id,
        fromCurrency: curr.code,
        toCurrency: workspace.baseCurrency,
      },
      orderBy: { effectiveDate: "desc" },
    });
    rates[curr.code] = latest ? { rate: Number(latest.rate), date: latest.effectiveDate } : null;
  }

  return rates;
}

export async function setExchangeRate(
  fromCurrency: string,
  rate: number
): Promise<ActionResult> {
  return safeAction("Set Exchange Rate", async () => {
    const workspace = await requireWorkspace();

    await db.exchangeRate.create({
      data: {
        workspaceId: workspace.id,
        fromCurrency,
        toCurrency: workspace.baseCurrency,
        rate,
        effectiveDate: new Date(),
      },
    });

    revalidatePath("/dashboard/settings/currencies");
  }, { fromCurrency, rate });
}

export async function getWorkspaceCurrency() {
  const workspace = await requireWorkspace();
  return {
    baseCurrency: workspace.baseCurrency,
  };
}

export async function getLatestRateForCurrency(fromCurrency: string): Promise<number | null> {
  const workspace = await requireWorkspace();
  if (fromCurrency === workspace.baseCurrency) return 1;

  const latest = await db.exchangeRate.findFirst({
    where: {
      workspaceId: workspace.id,
      fromCurrency,
      toCurrency: workspace.baseCurrency,
    },
    orderBy: { effectiveDate: "desc" },
  });

  return latest ? Number(latest.rate) : null;
}
