const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  // NBSP para o valor não quebrar linha
  return brlFormatter.format(value).replace(/\s/g, " ");
}

export function yearLabel(year: number): string {
  return year && year > 0 ? String(year) : "Algum dia";
}
