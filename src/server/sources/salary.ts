const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
const SYMBOL: Record<string, string> = { USD: "US$", EUR: "€", BRL: "R$", GBP: "£" };
const PERIOD: Record<string, string> = { annual: "ano", year: "ano", yearly: "ano", monthly: "mês", month: "mês", hourly: "hora" };

/** Faixa salarial legível; null quando a fonte não informa (0 conta como não informado). */
export function formatSalaryRange(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  currency = "USD",
  period = "annual",
): string | null {
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  if (!lo && !hi) return null;
  const symbol = SYMBOL[currency] ?? currency;
  const per = PERIOD[period] ? `/${PERIOD[period]}` : "";
  if (lo && hi) return `${symbol} ${fmt(lo)} – ${fmt(hi)}${per}`;
  return `${symbol} ${fmt(lo || hi)}${lo ? "+" : ""}${per}`;
}
