import type { ChecklistItemDTO } from "@/types";
import { faltaCents, pagoCents } from "@/lib/parcelas";

/* ============================================================
   Contas do checklist

   Depois que entrou parcelamento, "gasto" deixou de ser uma coisa só e virou
   três, que não podem ser confundidas:

     contratado — o que já foi decidido/reservado (itens marcados)
     pago       — o que efetivamente saiu do bolso
     a pagar    — contratado menos pago

   Uma passagem de R$ 2.280 em 6x, com 2 parcelas pagas, é R$ 2.280
   contratados, R$ 760 pagos e R$ 1.520 a pagar. Mostrar só um desses números
   daria a impressão errada em qualquer direção.
   ============================================================ */

/** O que já foi decidido: soma dos itens marcados como contratados. */
export function totalContratado(items: ChecklistItemDTO[]): number {
  return items.reduce((s, i) => s + (i.done ? (i.amountCents ?? 0) : 0), 0);
}

/**
 * O que já saiu do bolso.
 *
 * Conta todo item com parcela paga, marcado ou não: se o dinheiro saiu, saiu
 * — independente de alguém ter lembrado de marcar o item como resolvido.
 */
export function totalPago(items: ChecklistItemDTO[]): number {
  return items.reduce((s, i) => s + pagoCents(i), 0);
}

/** O que ainda vai sair, considerando só o que já está contratado. */
export function totalAPagar(items: ChecklistItemDTO[]): number {
  return items.reduce((s, i) => s + (i.done ? faltaCents(i) : 0), 0);
}

/** Quantos itens já foram contratados. */
export function feitos(items: ChecklistItemDTO[]): number {
  return items.filter((i) => i.done).length;
}

/**
 * Compara o CONTRATADO com a estimativa — e não o pago.
 *
 * O que estoura o orçamento é o compromisso assumido, não a data em que a
 * fatura cai. Comparar pelo pago diria "está dentro do orçamento" numa viagem
 * inteira parcelada que já custou o dobro do previsto.
 *
 * Devolve null quando não há o que comparar.
 */
export function compararComOrcamento(
  contratadoCents: number,
  orcamentoCents: number | null,
): { diferenca: number; acima: boolean } | null {
  if (!orcamentoCents || orcamentoCents <= 0 || contratadoCents <= 0)
    return null;
  const diferenca = contratadoCents - orcamentoCents;
  return { diferenca: Math.abs(diferenca), acima: diferenca > 0 };
}

/**
 * O que a viagem custou, ao todo — para uma viagem que já aconteceu.
 *
 * Soma duas coisas que moram em unidades diferentes: os itens do checklist
 * são POR PESSOA (a passagem de cada um), e os gastos avulsos são o TOTAL
 * que saiu da carteira (o Uber de R$ 40 dividido entre dois). Por isso o
 * checklist é multiplicado por `people` e os gastos não.
 *
 * Usa o CONTRATADO, e não o pago. Numa viagem que ainda vem, a diferença
 * entre os dois é o que ainda vai sair do bolso — a informação mais útil
 * que existe. Numa que já foi, não existe parcela futura que importe: o que
 * ficou contratado foi pago, e exigir que alguém tivesse marcado cada
 * parcela faria a viagem aparecer como se não tivesse custado nada.
 */
export function custoDaViagem(
  items: ChecklistItemDTO[],
  gastos: { totalCents: number }[],
  people: number,
): number {
  const porPessoa = totalContratado(items) * Math.max(1, people);
  return porPessoa + gastos.reduce((s, g) => s + g.totalCents, 0);
}
