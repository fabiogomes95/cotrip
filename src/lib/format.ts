/* ============================================================
   Dinheiro

   Regra da casa: valor monetário circula SEMPRE em centavos, como inteiro.
   Nada de float — 0.1 + 0.2 não dá 0.3 em ponto flutuante, e num app que
   soma orçamento de viagem isso vira diferença de alguns reais no total.

   A conversão para reais acontece só na hora de mostrar ou de ler o que a
   pessoa digitou.
   ============================================================ */

const semCentavos = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const comCentavos = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formata centavos para exibição.
 *
 * Só mostra os centavos quando eles existem: "R$ 4.200" é mais limpo que
 * "R$ 4.200,00" numa tela cheia de valores, e a maioria dos orçamentos é
 * redonda mesmo. Já um gasto real de R$ 2.190,47 aparece inteiro.
 */
export function formatBRL(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(centavos) || centavos <= 0) return "—";
  const fmt = centavos % 100 === 0 ? semCentavos : comCentavos;
  // NBSP para o valor não quebrar linha entre "R$" e o número
  return fmt.format(centavos / 100).replace(/\s/g, " ");
}

/**
 * Lê o que a pessoa digitou e devolve centavos.
 *
 * Aceita as formas que aparecem na prática: "2190", "2190,47", "2.190,47" e
 * "2190.47" (quem tem teclado configurado em inglês digita com ponto).
 * Devolve null para campo vazio ou entrada sem sentido.
 */
export function parseCentavos(texto: string): number | null {
  const limpo = texto.trim();
  if (!limpo) return null;

  const normalizado = limpo
    .replace(/[R$\s ]/gi, "")
    // Ponto seguido de exatamente 3 dígitos é separador de milhar ("2.190").
    // Seguido de 1 ou 2, é decimal ("2190.4") e fica.
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Centavos para o texto que vai dentro do campo de edição: 219047 -> "2190,47". */
export function centavosParaCampo(centavos: number | null | undefined): string {
  if (centavos == null) return "";
  return (centavos / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}

export function yearLabel(year: number): string {
  return year && year > 0 ? String(year) : "Algum dia";
}
