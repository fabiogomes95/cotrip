/**
 * A chave do tema no localStorage.
 *
 * Mora aqui, e não no componente do botão, porque dois lugares precisam
 * dela: o botão que escreve e o script embutido no layout que lê antes da
 * primeira pintura. O layout é componente de servidor — importar de um
 * arquivo "use client" só para pegar uma string acoplaria os dois à toa, e
 * repetir o literal nos dois lados é a receita para eles divergirem.
 */
export const CHAVE_TEMA = "cotrip-tema";

export type Tema = "sistema" | "claro" | "escuro";
