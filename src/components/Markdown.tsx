"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza o texto do diário.
 *
 * Duas decisões de segurança, ambas por omissão de propósito:
 *
 * - **Sem `rehype-raw`.** HTML escrito dentro do Markdown fica escapado e
 *   aparece como texto, em vez de virar marcação. Em quadro compartilhado o
 *   texto de uma pessoa é renderizado na tela de outra, então HTML cru seria
 *   uma porta de XSS aberta entre membros.
 * - **Sem imagens.** `![](url)` é descartado. Além de as fotos virem pela
 *   galeria no futuro, uma imagem de URL arbitrária vaza o IP de quem abre o
 *   quadro para o servidor de quem escreveu.
 *
 * O `remark-gfm` entra pelo que o diário realmente usa: listas de tarefa,
 * tabelas, texto riscado e links automáticos.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["img"]}
        unwrapDisallowed
        components={{
          a: ({ href, children: filhos }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {filhos}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
