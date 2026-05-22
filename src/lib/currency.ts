export const AVAILABLE_CURRENCIES = [
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
] as const;

export type CurrencyCode = (typeof AVAILABLE_CURRENCIES)[number]["code"];

export function getCurrencyInfo(code: string) {
  return AVAILABLE_CURRENCIES.find((c) => c.code === code) || { code, name: code, symbol: code };
}

export function formatMoney(amount: number | string, currencyCode: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${currencyCode}`;

  const info = getCurrencyInfo(currencyCode);
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: currencyCode === "KWD" || currencyCode === "BHD" || currencyCode === "OMR" ? 3 : 2,
    maximumFractionDigits: currencyCode === "KWD" || currencyCode === "BHD" || currencyCode === "OMR" ? 3 : 2,
  });

  return `${formatted} ${info.symbol}`;
}

export function formatMoneyShort(amount: number | string, currencyCode: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${currencyCode}`;
  return `${num.toLocaleString()} ${currencyCode}`;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  rate: number
): number {
  return amount * rate;
}
