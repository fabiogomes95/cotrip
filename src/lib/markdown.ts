/* ============================================================
   Markdown do diário

   O texto do diário é guardado como Markdown puro no mesmo campo `note` de
   sempre — nenhuma mudança no banco. Markdown é texto: o Postgres não precisa
   saber que virou Markdown, e o conteúdo continua legível sem o app, o que
   importa num diário que a pessoa vai querer ler daqui a dez anos.

   Guardar HTML seria o contrário: prende o conteúdo ao renderizador e abre
   uma porta de XSS em quadro compartilhado, onde o texto de uma pessoa é
   exibido na tela de outra.
   ============================================================ */

/**
 * Tira a marcação para exibir em espaços de uma linha (o preview do cartão,
 * um title, uma busca futura).
 *
 * Sem isto o cartão mostraria os asteriscos e cerquilhas crus: "**Dia 1** —
 * chegamos" em vez de "Dia 1 — chegamos".
 *
 * Não é um parser: é limpeza superficial, de propósito. Para um preview de
 * duas linhas, cobrir os casos comuns vale mais que arrastar um parser
 * inteiro para dentro do cartão.
 */
export function paraTextoSimples(md: string): string {
  return (
    md
      // blocos de código cercados viram só o conteúdo
      .replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      // imagens somem (não há o que mostrar em texto), links viram o rótulo
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // títulos, citações e marcadores de lista no começo da linha
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s{0,3}[-*+]\s+\[[ xX]\]\s+/gm, "")
      .replace(/^\s{0,3}[-*+]\s+/gm, "")
      .replace(/^\s{0,3}\d+\.\s+/gm, "")
      // linhas horizontais
      .replace(/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/gm, "")
      // ênfase: **negrito**, *itálico*, ~~riscado~~
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/~~(.*?)~~/g, "$2")
      // sobra de espaços e quebras
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** true quando o texto tem alguma marcação que valha a pena renderizar. */
export function temFormatacao(md: string): boolean {
  return paraTextoSimples(md) !== md.trim();
}
