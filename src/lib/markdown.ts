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

/** Marcação que vale dentro de uma linha, sem mexer na estrutura dela. */
function limparInline(t: string): string {
  return t
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$2");
}

/**
 * O resumo da nota para o cartão.
 *
 * Diferente de `paraTextoSimples`, que achata tudo numa linha: aqui a
 * ESTRUTURA importa. Um diário com "## Antes de ir" seguido de três itens
 * de lista, achatado com espaços, vira "Antes de ir Passagem emitida Taxa
 * paga" — uma frase corrida que ninguém escreveu e que não quer dizer nada.
 *
 * Cada título e cada item de lista viram um bloco; linhas seguidas de texto
 * comum continuam sendo um parágrafo só. Os blocos são separados por "·",
 * que devolve ao preview a cara de lista que o original tem.
 */
export function resumoDaNota(md: string, maxBlocos = 6): string {
  const semCerca = md.replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1");

  const blocos: string[] = [];
  let paragrafo: string[] = [];
  const fechar = () => {
    const t = paragrafo.join(" ").trim();
    if (t) blocos.push(t);
    paragrafo = [];
  };

  for (const crua of semCerca.split("\n")) {
    // A régua horizontal é testada antes do item de lista: "- - -" casaria
    // com os dois, e ali não há texto nenhum para mostrar.
    const regua = /^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(crua);
    if (!crua.trim() || regua) {
      fechar();
      continue;
    }

    const titulo = /^\s{0,3}#{1,6}\s+/.test(crua);
    const item = /^\s{0,3}(?:[-*+]|\d+\.)\s+/.test(crua);

    const texto = limparInline(
      crua
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s{0,3}>\s?/, "")
        .replace(/^\s{0,3}[-*+]\s+\[[ xX]\]\s+/, "")
        .replace(/^\s{0,3}[-*+]\s+/, "")
        .replace(/^\s{0,3}\d+\.\s+/, ""),
    )
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!texto) continue;

    if (titulo || item) {
      fechar();
      blocos.push(texto);
    } else {
      paragrafo.push(texto);
    }
  }
  fechar();

  return blocos.slice(0, maxBlocos).join(" · ");
}

/** true quando o texto tem alguma marcação que valha a pena renderizar. */
export function temFormatacao(md: string): boolean {
  return paraTextoSimples(md) !== md.trim();
}
