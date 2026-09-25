import type { PreTaskDTO, PreTripWhen } from "@/types";

/* ============================================================
   Checklist de antes de sair

   A lista é agrupada por momento, e não ordenada por data: "na véspera" é
   mais útil que "11 de novembro", e continua valendo se a viagem mudar de
   dia — que é o que sempre acontece.
   ============================================================ */

export const MOMENTOS: readonly PreTripWhen[] = ["ANTES", "VESPERA", "SAIDA"];

export const MOMENTO_LABEL: Record<PreTripWhen, string> = {
  ANTES: "Com antecedência",
  VESPERA: "Na véspera",
  SAIDA: "Na hora de sair",
};

export function isMomento(v: unknown): v is PreTripWhen {
  return typeof v === "string" && (MOMENTOS as readonly string[]).includes(v);
}

/** Agrupa na ordem dos momentos, pulando os que estão vazios. */
export function agruparPorMomento(
  tarefas: PreTaskDTO[],
): Array<{ momento: PreTripWhen; tarefas: PreTaskDTO[] }> {
  return MOMENTOS.map((momento) => ({
    momento,
    tarefas: tarefas
      .filter((t) => t.when === momento)
      .sort((a, b) => a.position - b.position),
  })).filter((g) => g.tarefas.length > 0);
}

/** Quantas já foram feitas, para a barra de progresso. */
export function progresso(tarefas: PreTaskDTO[]): {
  feitas: number;
  total: number;
  pct: number;
  tudoPronto: boolean;
} {
  const total = tarefas.length;
  const feitas = tarefas.filter((t) => t.done).length;
  return {
    feitas,
    total,
    pct: total ? Math.round((feitas / total) * 100) : 0,
    // Lista vazia não é "tudo pronto": é lista vazia. Sem esta distinção o
    // app daria um joinha para quem não preparou nada.
    tudoPronto: total > 0 && feitas === total,
  };
}

/**
 * Quem ficou com o quê, para a pessoa conferir de relance se combinou tudo.
 * Só tarefas com responsável e ainda pendentes — o que já foi feito não
 * precisa de cobrança.
 */
export function pendenciasPorPessoa(
  tarefas: PreTaskDTO[],
): Array<{ pessoa: string; tarefas: string[] }> {
  const mapa = new Map<string, string[]>();
  for (const t of tarefas) {
    const quem = t.assignee.trim();
    if (!quem || t.done) continue;
    const lista = mapa.get(quem) ?? [];
    lista.push(t.label);
    mapa.set(quem, lista);
  }
  return [...mapa.entries()]
    .map(([pessoa, lista]) => ({ pessoa, tarefas: lista }))
    .sort((a, b) => a.pessoa.localeCompare(b.pessoa, "pt-BR"));
}
