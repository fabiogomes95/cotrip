"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";


/* O renderizador de Markdown pesa ~48KB e só entra em cena quando alguém
   abre a aba "Ler" de uma viagem. Carregado sob demanda, ele sai do pacote
   principal: a página do quadro volta a abrir leve, e o custo só aparece
   para quem de fato vai ler o diário.

   `ssr: false` porque não há nada a renderizar no servidor — a aba começa
   em "Escrever". */
const Markdown = dynamic(
  () => import("@/components/Markdown").then((m) => m.Markdown),
  {
    ssr: false,
    loading: () => <p className="check-vazio">Carregando o diário…</p>,
  },
);

export const ATALHOS = [
  { rotulo: "T", titulo: "Título", prefixo: "## ", sufixo: "", linha: true },
  { rotulo: "B", titulo: "Negrito", prefixo: "**", sufixo: "**", linha: false },
  { rotulo: "i", titulo: "Itálico", prefixo: "_", sufixo: "_", linha: false },
  { rotulo: "•", titulo: "Lista", prefixo: "- ", sufixo: "", linha: true },
  { rotulo: "☑", titulo: "Tarefa", prefixo: "- [ ] ", sufixo: "", linha: true },
  { rotulo: "❝", titulo: "Destaque", prefixo: "> ", sufixo: "", linha: true },
] as const;

export function DiarioField({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  const [aba, setAba] = useState<"escrever" | "ler">("escrever");
  const ref = useRef<HTMLTextAreaElement>(null);

  /**
   * Aplica um atalho no que está selecionado.
   *
   * Os de linha (título, lista, citação) vão no começo de CADA linha
   * selecionada — marcar três linhas e clicar em lista precisa virar três
   * itens, não um marcador solto no meio do texto.
   */
  function aplicar(atalho: (typeof ATALHOS)[number]) {
    const ta = ref.current;
    if (!ta) return;

    const ini = ta.selectionStart;
    const fim = ta.selectionEnd;
    const selecionado = valor.slice(ini, fim);

    let novo: string;
    let cursor: number;

    if (atalho.linha) {
      const inicioDaLinha = valor.lastIndexOf("\n", ini - 1) + 1;
      const trecho = valor.slice(inicioDaLinha, fim) || "";
      const comPrefixo = trecho
        .split("\n")
        .map((l) => (l.startsWith(atalho.prefixo) ? l : atalho.prefixo + l))
        .join("\n");
      novo = valor.slice(0, inicioDaLinha) + comPrefixo + valor.slice(fim);
      cursor = inicioDaLinha + comPrefixo.length;
    } else {
      const texto = selecionado || atalho.titulo.toLowerCase();
      novo =
        valor.slice(0, ini) + atalho.prefixo + texto + atalho.sufixo + valor.slice(fim);
      // Sem seleção, deixa o cursor dentro dos marcadores para já digitar.
      cursor = ini + atalho.prefixo.length + texto.length;
    }

    onChange(novo);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="field diario">
      <div className="diario-topo">
        <label className="rotulo" htmlFor="t-note">Diário</label>
        <div className="abas">
          <button
            type="button"
            aria-pressed={aba === "escrever"}
            onClick={() => setAba("escrever")}
          >
            Escrever
          </button>
          <button
            type="button"
            aria-pressed={aba === "ler"}
            onClick={() => setAba("ler")}
          >
            Ler
          </button>
        </div>
      </div>

      {aba === "escrever" ? (
        <>
          <div className="diario-atalhos">
            {ATALHOS.map((a) => (
              <button
                key={a.titulo}
                type="button"
                title={a.titulo}
                aria-label={a.titulo}
                onClick={() => aplicar(a)}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <textarea
            id="t-note"
            ref={ref}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder={"Como foi o dia, com quem, o que valeu a pena…\n\n## Dia 1\n- chegada\n- **pôr do sol** na duna"}
            rows={8}
          />
          <p className="diario-dica">
            Aceita Markdown: <code>##</code> título, <code>**negrito**</code>,{" "}
            <code>-</code> lista.
          </p>
        </>
      ) : valor.trim() ? (
        <div className="diario-leitura">
          <Markdown>{valor}</Markdown>
        </div>
      ) : (
        <p className="check-vazio">O diário desta viagem ainda está em branco.</p>
      )}
    </div>
  );
}

/* ============================================================
   Antes de sair — casa, pets, logística

   Lista separada da de gastos de propósito: aqui nada tem valor, e o que
   importa é quem ficou responsável. Cada momento tem o próprio campo de
   adicionar, então o "quando" vem de onde a pessoa digitou, sem precisar
   escolher num seletor.
   ============================================================ */
