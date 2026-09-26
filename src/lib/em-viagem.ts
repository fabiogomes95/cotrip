import type { ActivityDTO, ExpenseDTO, TripDTO } from "@/types";
import { diasAte, hojeUTC, paraISO } from "@/lib/datas";
import { totalGasto } from "@/lib/gastos";

/* ============================================================
   Modo viagem

   O app sabia planejar (antes) e lembrar (depois), e não fazia nada no
   meio — justamente quando a pessoa está lá. Este módulo responde às
   perguntas desse momento: que dia é hoje da viagem, o que está marcado
   para agora, onde é a pousada, quanto já saiu.

   Só cálculo aqui. A tela é o EmViagem.tsx; separar é o que permite testar
   a virada do dia sem montar componente nenhum.
   ============================================================ */

export type Panorama = {
  /** Dia atual da viagem, começando em 1 no dia da chegada. */
  dia: number;
  /** Duração em dias de calendário (noites + 1). null quando não há volta. */
  totalDias: number | null;
  /** Atividades marcadas para hoje. */
  hoje: ActivityDTO[];
  /** As próximas, depois de hoje, em ordem de data. */
  aSeguir: ActivityDTO[];
  /** Atividades sem data marcada, que continuam valendo como ideia. */
  semData: ActivityDTO[];
  /** Total já gasto no destino, em centavos. */
  gastoCents: number;
  /** Gastos lançados hoje, para o "hoje você gastou X". */
  gastoHojeCents: number;
};

/**
 * A viagem está acontecendo agora?
 *
 * Usa as mesmas bordas do `contagem`: conta a partir do dia da ida e até o
 * fim do dia da volta. Uma viagem que termina hoje ainda está acontecendo —
 * quem está no aeroporto de volta ainda está viajando.
 *
 * Sem data de volta, vale só o dia da ida: sem saber quando acaba, supor
 * que continua para sempre deixaria o painel travado em modo viagem.
 */
export function estaEmViagem(trip: TripDTO, agora: Date = new Date()): boolean {
  if (trip.status === "FEITA" || !trip.startDate) return false;
  const paraIda = diasAte(trip.startDate, agora);
  if (paraIda > 0) return false;
  return diasAte(trip.endDate ?? trip.startDate, agora) >= 0;
}

/** O panorama do dia. null quando a viagem não está acontecendo. */
export function panoramaDaViagem(
  trip: TripDTO,
  agora: Date = new Date(),
): Panorama | null {
  if (!estaEmViagem(trip, agora)) return null;

  const hojeISO = paraISO(hojeUTC(agora));

  // diasAte é negativo depois que começou: -2 no terceiro dia.
  const dia = 1 - diasAte(trip.startDate!, agora);

  const totalDias = trip.endDate
    ? diasAte(trip.endDate, agora) - diasAte(trip.startDate!, agora) + 1
    : null;

  /* Atividade já FEITA sai da lista do dia: o painel é o que ainda vai
     acontecer, e manter o que já rolou faria a lista só crescer. */
  const pendentes = trip.activities.filter((a) => a.status !== "FEITO");
  const comData = pendentes.filter((a) => a.whenAt);

  const hoje = comData
    .filter((a) => a.whenAt === hojeISO)
    .sort(ordemNoDia);

  const aSeguir = comData
    .filter((a) => a.whenAt! > hojeISO)
    .sort((a, b) => a.whenAt!.localeCompare(b.whenAt!) || ordemNoDia(a, b));

  const semData = pendentes.filter((a) => !a.whenAt).sort(ordemNoDia);

  return {
    dia,
    totalDias,
    hoje,
    aSeguir,
    semData,
    gastoCents: totalGasto(trip.expenses),
    gastoHojeCents: totalGasto(
      trip.expenses.filter((g: ExpenseDTO) => g.spentOn === hojeISO),
    ),
  };
}

/* Dentro do mesmo dia manda a ordem que a pessoa arrastou. `timeText` é
   texto livre ("de manhã", "9h") e não dá para ordenar sem inventar uma
   interpretação — "fim da tarde" não se compara com "14h". */
function ordemNoDia(a: ActivityDTO, b: ActivityDTO): number {
  return a.position - b.position;
}
