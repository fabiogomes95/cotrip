import { pagoCents } from "@/lib/parcelas";

/* ============================================================
   Acerto de contas

   Quando duas pessoas dividem uma viagem, alguém sempre paga mais que a
   própria parte — a passagem sai no cartão de um, a pousada no do outro. Este
   arquivo responde a pergunta que aparece no fim: quem deve quanto a quem.

   Conta com o que JÁ FOI PAGO, não com o contratado. Dívida entre amigos
   nasce quando o dinheiro sai, não quando a reserva é feita.
   ============================================================ */

export type ItemAcerto = {
  amountCents: number | null;
  downPaymentCents: number | null;
  downPaymentPaid: boolean;
  installments: number;
  paidInstallments: number;
  paidById: string | null;
};

export type Pessoa = { userId: string; name: string };

export type Saldo = {
  userId: string;
  name: string;
  /** Quanto essa pessoa tirou do bolso, em centavos. */
  desembolsou: number;
  /** Quanto caberia a ela pagar. */
  parte: number;
  /** Positivo: tem a receber. Negativo: deve. */
  saldo: number;
};

export type Transferencia = { de: string; para: string; valor: number };

/**
 * Calcula quanto cada pessoa desembolsou e quanto deveria ter desembolsado.
 *
 * `people` é quanta gente viaja: os valores dos itens são POR PESSOA, então o
 * desembolso real de um item é `pago × people`. A divisão, por sua vez, é
 * entre os membros do quadro — que são as pessoas com quem dá para acertar.
 */
export function calcularSaldos(
  items: ItemAcerto[],
  membros: Pessoa[],
  people: number,
): Saldo[] {
  if (membros.length === 0) return [];

  const multiplicador = Math.max(1, people);
  const porPessoa = new Map(membros.map((m) => [m.userId, 0]));
  let totalPago = 0;

  for (const item of items) {
    const pago = pagoCents(item) * multiplicador;
    if (pago <= 0) continue;
    totalPago += pago;
    // Item pago por alguém de fora do quadro (ou sem dono) entra no total —
    // o dinheiro saiu — mas não vira crédito de ninguém.
    if (item.paidById && porPessoa.has(item.paidById)) {
      porPessoa.set(item.paidById, porPessoa.get(item.paidById)! + pago);
    }
  }

  // A divisão exata raramente é inteira. Distribuo o resto de centavos entre
  // os primeiros para que a soma das partes feche com o total — senão o
  // acerto nunca zera e sobra um centavo fantasma.
  const base = Math.floor(totalPago / membros.length);
  const resto = totalPago - base * membros.length;

  return membros.map((m, i) => {
    const parte = base + (i < resto ? 1 : 0);
    const desembolsou = porPessoa.get(m.userId) ?? 0;
    return { userId: m.userId, name: m.name, desembolsou, parte, saldo: desembolsou - parte };
  });
}

/**
 * Sugere os pagamentos que zeram os saldos.
 *
 * Estratégia gulosa: quem mais deve paga quem mais tem a receber, até um dos
 * dois zerar. Não garante o mínimo teórico de transferências, mas nunca passa
 * de (pessoas − 1) — e para um grupo de viagem isso é o suficiente.
 */
export function sugerirPagamentos(saldos: Saldo[]): Transferencia[] {
  const devedores = saldos
    .filter((s) => s.saldo < 0)
    .map((s) => ({ nome: s.name, valor: -s.saldo }))
    .sort((a, b) => b.valor - a.valor);
  const credores = saldos
    .filter((s) => s.saldo > 0)
    .map((s) => ({ nome: s.name, valor: s.saldo }))
    .sort((a, b) => b.valor - a.valor);

  const transferencias: Transferencia[] = [];
  let i = 0;
  let j = 0;

  while (i < devedores.length && j < credores.length) {
    const valor = Math.min(devedores[i]!.valor, credores[j]!.valor);
    if (valor > 0) {
      transferencias.push({ de: devedores[i]!.nome, para: credores[j]!.nome, valor });
    }
    devedores[i]!.valor -= valor;
    credores[j]!.valor -= valor;
    if (devedores[i]!.valor === 0) i++;
    if (credores[j]!.valor === 0) j++;
  }

  return transferencias;
}
