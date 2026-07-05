const LOCALE_BY_CURRENCY: Record<string, string> = {
  USD: "en-US",
  BRL: "pt-BR",
};

export function formatMoney(amount: number, currency: string): string {
  const normalized = currency.toUpperCase();
  const locale = LOCALE_BY_CURRENCY[normalized] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalized,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface ChangeDisplay {
  text: string;
  direction: "up" | "down" | "flat";
}

export function formatChangePct(changePct: number | null, comparisonLabel: string): ChangeDisplay | null {
  if (changePct === null) return null;

  const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

  return {
    text: `${arrow} ${Math.abs(changePct).toFixed(1)}% vs. ${comparisonLabel}`,
    direction,
  };
}
