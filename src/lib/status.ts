// Fonte única de verdade para os status de uma viagem.
export const STATUSES = ["IDEIA", "PLANEJANDO", "RESERVADO", "FEITA"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  IDEIA: "Ideia",
  PLANEJANDO: "Planejando",
  RESERVADO: "Reservado",
  FEITA: "Feita",
};

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

// Avança para o próximo status no ciclo (usado no "toque para avançar").
export function nextStatus(s: Status): Status {
  const i = STATUSES.indexOf(s);
  return STATUSES[(i + 1) % STATUSES.length];
}

/**
 * O token CSS da cor de cada status.
 *
 * Mapa explícito, e não `--st-${status.toLowerCase()}`: os nomes dos tokens
 * são abreviados (--st-plan, --st-reserv) e o template gerava
 * --st-planejando e --st-reservado, que não existem. Variável CSS
 * inexistente não dá erro em lugar nenhum — a bolinha simplesmente sumia.
 */
export const STATUS_COR: Record<Status, string> = {
  IDEIA: "var(--st-ideia)",
  PLANEJANDO: "var(--st-plan)",
  RESERVADO: "var(--st-reserv)",
  FEITA: "var(--st-feita)",
};
