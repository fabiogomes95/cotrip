import type { PreTripWhen } from "@/types";

/**
 * Tarefas criadas junto com toda viagem nova.
 *
 * Diferente do checklist de gastos, esta lista é quase igual em toda viagem —
 * é a rotina de fechar a casa. Por isso vem pronta: o trabalho da pessoa
 * passa a ser apagar o que não se aplica, em vez de lembrar de tudo do zero
 * às onze da noite da véspera.
 *
 * Para mudar a rotina, edite aqui — vale para as próximas viagens.
 */
export const PRE_VIAGEM_PADRAO: ReadonlyArray<{
  label: string;
  when: PreTripWhen;
}> = [
  { label: "Combinar quem cuida dos pets", when: "ANTES" },
  { label: "Deixar ração e areia suficientes", when: "ANTES" },
  { label: "Deixar uma cópia da chave com alguém", when: "ANTES" },
  { label: "Avisar no trabalho", when: "ANTES" },
  { label: "Separar documentos e carregadores", when: "VESPERA" },
  { label: "Tirar o lixo", when: "VESPERA" },
  { label: "Fechar o registro de água", when: "SAIDA" },
  { label: "Fechar o gás", when: "SAIDA" },
  { label: "Tirar aparelhos da tomada", when: "SAIDA" },
  { label: "Trancar tudo e conferir as janelas", when: "SAIDA" },
];
