/** Constantes compartilhadas entre o quadro e o modal de viagem. */

export const CUR = new Date().getFullYear();

/** Anos que a linha do tempo mostra mesmo sem viagem marcada neles. */
export const BASE_YEARS = [CUR, CUR + 1, CUR + 2, CUR + 3];

/** Intervalo do polling que reflete edições de quem está junto. */
export const POLL_MS = 12000;
