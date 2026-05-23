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

    if (!currency) throw new Error("Currency not found");
    if (currency.isBase) throw new Error("Cannot remove the base currency");

    const dealsCount = await db.deal.count({
      where: { workspaceId: workspace.id, currency: currency.code, deletedAt: null },
    });
    const invoicesCount = await db.invoice.count({
      where: { workspaceId: workspace.id, currency: currency.code },
    });

    if (dealsCount > 0 || invoicesCount > 0) {
      const parts: string[] = [];
      if (dealsCount > 0) parts.push(`${dealsCount} deal${dealsCount > 1 ? "s" : ""}`);
      if (invoicesCount > 0) parts.push(`${invoicesCount} invoice${invoicesCount > 1 ? "s" : ""}`);
      throw new Error(`Cannot remove ${currency.code} — it is used by ${parts.join(" and ")}`);
    }

    await db.currency.delete({ where: { id } });
    await db.exchangeRate.deleteMany({
      where: { workspaceId: workspace.id, fromCurrency: currency.code },
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
  rate: number,
  effectiveDate?: string
): Promise<ActionResult> {
  return safeAction("Set Exchange Rate", async () => {
    const workspace = await requireWorkspace();

    const date = effectiveDate ? new Date(effectiveDate) : new Date();

    await db.exchangeRate.create({
      data: {
        workspaceId: workspace.id,
        fromCurrency,
        toCurrency: workspace.baseCurrency,
        rate,
        effectiveDate: date,
      },
    });

    revalidatePath("/dashboard/settings/currencies");
  }, { fromCurrency, rate, effectiveDate });
}

export async function getWorkspaceCurrency() {
  const workspace = await requireWorkspace();
  return {
    baseCurrency: workspace.baseCurrency,
  };
}

export async function getLatestRateForCurrency(fromCurrency: string, asOfDate?: Date): Promise<number | null> {
  const workspace = await requireWorkspace();
  if (fromCurrency === workspace.baseCurrency) return 1;

  const latest = await db.exchangeRate.findFirst({
    where: {
      workspaceId: workspace.id,
      fromCurrency,
      toCurrency: workspace.baseCurrency,
      ...(asOfDate ? { effectiveDate: { lte: asOfDate } } : {}),
    },
    orderBy: { effectiveDate: "desc" },
  });

  return latest ? Number(latest.rate) : null;
}
