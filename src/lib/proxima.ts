import type { TripDTO } from "@/types";
import { diasAte, hojeUTC, paraISO } from "@/lib/datas";

/* ============================================================
   Qual viagem vai no painel de destaque

   A pergunta que o painel responde é "e a próxima?". A ordem de prioridade
   segue o que a pessoa tem na cabeça, não o que é mais fácil de calcular.
   ============================================================ */

const PESO_STATUS: Record<string, number> = {
  RESERVADO: 0,
  PLANEJANDO: 1,
  IDEIA: 2,
};

/**
 * Escolhe a viagem em destaque.
 *
 * 1. A que está acontecendo agora. Nada compete com isso.
 * 2. A com data marcada mais próxima no futuro.
 * 3. Sem data, a do ano mais próximo — desempatando pelo status, porque
 *    "reservado" é compromisso e "ideia" é vontade.
 *
 * Viagem já feita nunca entra: ela tem o bloco "Já rolou".
 */
export function proximaViagem(trips: TripDTO[], agora: Date = new Date()): TripDTO | null {
  const vivas = trips.filter((t) => t.status !== "FEITA");
  if (vivas.length === 0) return null;

  const emAndamento = vivas.filter(
    (t) =>
      t.startDate &&
      diasAte(t.startDate, agora) <= 0 &&
      diasAte(t.endDate ?? t.startDate, agora) >= 0,
  );
  if (emAndamento.length > 0) {
    // Se por algum motivo houver duas, a que começou por último é a atual.
    return emAndamento.sort((a, b) => (b.startDate! < a.startDate! ? -1 : 1))[0]!;
  }

  const futuras = vivas
    .filter((t) => t.startDate && diasAte(t.startDate, agora) > 0)
    .sort((a, b) => diasAte(a.startDate!, agora) - diasAte(b.startDate!, agora));
  if (futuras.length > 0) return futuras[0]!;

  const anoAtual = Number(paraISO(hojeUTC(agora)).slice(0, 4));
  const porAno = vivas
    .filter((t) => t.year > 0 && t.year >= anoAtual && !t.startDate)
    .sort(
      (a, b) =>
        a.year - b.year ||
        (PESO_STATUS[a.status] ?? 9) - (PESO_STATUS[b.status] ?? 9) ||
        a.dest.localeCompare(b.dest, "pt-BR"),
    );
  return porAno[0] ?? null;
}

/** As pendências que o painel mostra, já resumidas. */
export type Pendencias = {
  aPagar: number;
  itensAbertos: number;
  tarefasAbertas: number;
  tarefasTotal: number;
};
