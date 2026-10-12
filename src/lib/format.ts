const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const compactPriceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

/** Pour les graduations d'axe : pas de centimes quand ce n'est pas utile. */
export function formatAxisPrice(value: number): string {
  return Number.isInteger(value) ? compactPriceFormatter.format(value) : priceFormatter.format(value);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)} %`;
}
