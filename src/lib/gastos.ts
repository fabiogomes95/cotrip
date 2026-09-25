import type { ExpenseDTO, ExpenseCategory } from "@/types";

/* ============================================================
   Gastos avulsos do destino

   O pedido que originou isto: "isolar os gastos contínuos com Uber, que
   costumam fugir do controle". Fogem justamente porque são muitos e
   pequenos — R$ 22 aqui, R$ 31 ali — e ninguém soma. O valor deste módulo
   está na CATEGORIA: ver "transporte: R$ 380" é o que faz cair a ficha.

   Unidade: `totalCents` é o valor cheio que saiu da carteira, diferente do
   checklist de gastos, que é por pessoa. Um Uber de R$ 40 dividido entre
   dois é 4000 aqui, não 2000.
   ============================================================ */

export const CATEGORIAS: readonly ExpenseCategory[] = [
  "TRANSPORTE",
  "ALIMENTACAO",
  "PASSEIO",
  "COMPRAS",
  "OUTROS",
];

export const CATEGORIA_LABEL: Record<ExpenseCategory, string> = {
  TRANSPORTE: "Transporte",
  ALIMENTACAO: "Alimentação",
  PASSEIO: "Passeios",
  COMPRAS: "Compras",
  OUTROS: "Outros",
};

/** Total gasto, em centavos. */
export function totalGasto(gastos: ExpenseDTO[]): number {
  return gastos.reduce((s, g) => s + g.totalCents, 0);
}

/**
 * Soma por categoria, da maior para a menor.
 *
 * Ordenar por valor, e não pela ordem fixa das categorias, é o que responde
 * de imediato "onde meu dinheiro está indo" — que é a pergunta que o módulo
 * existe para responder. Categoria sem gasto não aparece.
 */
export function porCategoria(
  gastos: ExpenseDTO[],
): Array<{ categoria: ExpenseCategory; total: number; pct: number }> {
  const total = totalGasto(gastos);
  if (total === 0) return [];

  const soma = new Map<ExpenseCategory, number>();
  for (const g of gastos) {
    soma.set(g.category, (soma.get(g.category) ?? 0) + g.totalCents);
  }

  return [...soma.entries()]
    .map(([categoria, valor]) => ({
      categoria,
      total: valor,
      pct: Math.round((valor / total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Quanto cabe a cada um, para comparar com o orçamento por pessoa. */
export function porPessoa(gastos: ExpenseDTO[], people: number): number {
  return Math.round(totalGasto(gastos) / Math.max(1, people));
}

/**
 * Gasto médio por dia de viagem — o número que dá a real da sangria diária.
 * null quando a viagem não tem datas: sem duração não há média.
 */
export function mediaPorDia(gastos: ExpenseDTO[], dias: number | null): number | null {
  if (!dias || dias <= 0) return null;
  return Math.round(totalGasto(gastos) / dias);
}
