import { somarMeses } from "@/lib/datas";

/* ============================================================
   Parcelamento

   O item guarda o TOTAL (`amountCents`), em quantas vezes (`installments`) e
   quantas já foram pagas (`paidInstallments`). Tudo o mais é derivado daqui.

   A distinção que dá sentido a este arquivo: `done` significa CONTRATADO, não
   pago. Passagem em 6x está contratada no primeiro dia e paga só no sexto mês
   — e é essa diferença que responde "quanto ainda vai sair do bolso".
   ============================================================ */

/* Dois contratos em vez de um: quase toda conta aqui precisa só do valor e
   das parcelas. Exigir `firstDueDate` em todas obrigaria quem só quer somar o
   que foi pago a carregar um campo que não usa. */
export type ItemPagavel = {
  amountCents: number | null;
  /** Entrada: pedaço pago na compra. O restante é que se parcela. */
  downPaymentCents: number | null;
  downPaymentPaid: boolean;
  installments: number;
  paidInstallments: number;
};

export type ItemComVencimento = ItemPagavel & { firstDueDate: string | null };

/**
 * Normaliza os números antes de qualquer conta.
 *
 * A entrada é limitada ao total: um valor maior seria uma compra em que se
 * paga mais na entrada do que a coisa custa, e o resto ficaria negativo.
 */
function saneadas(item: ItemPagavel): {
  total: number;
  entrada: number;
  restante: number;
  n: number;
  pagas: number;
} {
  const total = Math.max(0, item.amountCents ?? 0);
  const entrada = Math.min(total, Math.max(0, item.downPaymentCents ?? 0));
  const n = Math.max(1, Math.trunc(item.installments || 1));
  const pagas = Math.min(n, Math.max(0, Math.trunc(item.paidInstallments || 0)));
  return { total, entrada, restante: total - entrada, n, pagas };
}

/** Valor da entrada já normalizado (nunca maior que o total). */
export function valorEntrada(item: ItemPagavel): number {
  return saneadas(item).entrada;
}

/** Quanto vale cada parcela do RESTANTE, arredondado ao centavo. */
export function valorParcela(item: ItemPagavel): number {
  const { restante, n } = saneadas(item);
  return restante > 0 ? Math.round(restante / n) : 0;
}

/**
 * Quanto já saiu do bolso: a entrada (se paga) mais as parcelas quitadas.
 *
 * Quando todas as parcelas foram pagas soma o restante inteiro, em vez de
 * `parcela × n`: com arredondamento, 100 em 3x daria 33+33+33 = 99 e um
 * centavo ficaria pendurado para sempre.
 */
export function pagoCents(item: ItemPagavel): number {
  const { total, entrada, restante, n, pagas } = saneadas(item);
  if (total <= 0) return 0;

  const daEntrada = item.downPaymentPaid ? entrada : 0;
  const dasParcelas =
    pagas <= 0 ? 0 : pagas >= n ? restante : Math.round((restante * pagas) / n);

  return daEntrada + dasParcelas;
}

/** Quanto ainda falta pagar deste item. */
export function faltaCents(item: ItemPagavel): number {
  const { total } = saneadas(item);
  return Math.max(0, total - pagoCents(item));
}

export function quitado(item: ItemPagavel): boolean {
  const { total } = saneadas(item);
  // Definido pelo dinheiro, não pela contagem: um item com entrada ainda em
  // aberto não está quitado mesmo com todas as parcelas pagas.
  return total > 0 && faltaCents(item) === 0;
}

/**
 * Data da próxima parcela a vencer, ou null.
 *
 * Assume uma parcela por mês a partir de `firstDueDate` — que é como cartão
 * e a maioria dos parcelamentos de viagem funcionam.
 */
export function proximoVencimento(item: ItemComVencimento): string | null {
  const { restante, n, pagas } = saneadas(item);
  if (!item.firstDueDate || restante <= 0 || pagas >= n) return null;
  return somarMeses(item.firstDueDate, pagas);
}

/** Parcelas que ainda vão vencer. */
export function parcelasRestantes(item: ItemPagavel): number {
  const { restante, n, pagas } = saneadas(item);
  if (restante <= 0) return 0; // pago inteiro na entrada: não há parcelas
  return Math.max(0, n - pagas);
}
