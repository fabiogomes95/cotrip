import { somarMeses } from "@/lib/datas";

/* ============================================================
   Parcelamento

   O item guarda o TOTAL (`amountCents`), em quantas vezes (`installments`) e
   quantas já foram pagas (`paidInstallments`). Tudo o mais é derivado daqui.

   A distinção que dá sentido a este arquivo: `done` significa CONTRATADO, não
   pago. Passagem em 6x está contratada no primeiro dia e paga só no sexto mês
   — e é essa diferença que responde "quanto ainda vai sair do bolso".
   ============================================================ */

export type ItemPagavel = {
  amountCents: number | null;
  installments: number;
  paidInstallments: number;
  firstDueDate: string | null;
};

/** Normaliza entradas fora de faixa em vez de confiar no que vem do banco. */
function saneadas(item: ItemPagavel): { total: number; n: number; pagas: number } {
  const total = item.amountCents ?? 0;
  const n = Math.max(1, Math.trunc(item.installments || 1));
  const pagas = Math.min(n, Math.max(0, Math.trunc(item.paidInstallments || 0)));
  return { total, n, pagas };
}

/** Quanto vale cada parcela, arredondado ao centavo. */
export function valorParcela(item: ItemPagavel): number {
  const { total, n } = saneadas(item);
  return total > 0 ? Math.round(total / n) : 0;
}

/**
 * Quanto já saiu do bolso.
 *
 * Quando todas as parcelas foram pagas devolve o total cheio, em vez de
 * `parcela × n`: com arredondamento, 100 em 3x daria 33+33+33 = 99 e um
 * centavo ficaria pendurado para sempre.
 */
export function pagoCents(item: ItemPagavel): number {
  const { total, n, pagas } = saneadas(item);
  if (total <= 0 || pagas <= 0) return 0;
  if (pagas >= n) return total;
  return Math.round((total * pagas) / n);
}

/** Quanto ainda falta pagar deste item. */
export function faltaCents(item: ItemPagavel): number {
  const { total } = saneadas(item);
  return Math.max(0, total - pagoCents(item));
}

export function quitado(item: ItemPagavel): boolean {
  const { total, n, pagas } = saneadas(item);
  return total > 0 && pagas >= n;
}

/**
 * Data da próxima parcela a vencer, ou null.
 *
 * Assume uma parcela por mês a partir de `firstDueDate` — que é como cartão
 * e a maioria dos parcelamentos de viagem funcionam.
 */
export function proximoVencimento(item: ItemPagavel): string | null {
  const { n, pagas } = saneadas(item);
  if (!item.firstDueDate || pagas >= n) return null;
  return somarMeses(item.firstDueDate, pagas);
}

/** Parcelas que ainda vão vencer. */
export function parcelasRestantes(item: ItemPagavel): number {
  const { n, pagas } = saneadas(item);
  return Math.max(0, n - pagas);
}
