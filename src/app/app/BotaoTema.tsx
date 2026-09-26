"use client";

import { useSyncExternalStore } from "react";

import { CHAVE_TEMA, type Tema } from "@/lib/tema";

/**
 * Alternador de tema: sistema → claro → escuro → sistema.
 *
 * Três estados, e não dois, porque "acompanhar o sistema" é a posição certa
 * para a maioria — o celular já escurece sozinho à noite. O override manual
 * existe para quem quer o app claro de dia num sistema escuro, ou o
 * contrário. Sem a opção "sistema", quem trocasse uma vez ficaria preso
 * naquele tema para sempre.
 */

const CICLO: Record<Tema, Tema> = {
  sistema: "claro",
  claro: "escuro",
  escuro: "sistema",
};

const ROTULO: Record<Tema, string> = {
  sistema: "Tema: acompanhando o sistema",
  claro: "Tema: claro",
  escuro: "Tema: escuro",
};

/**
 * Escreve a escolha no documento.
 *
 * "sistema" REMOVE o atributo em vez de calcular o tema atual: assim o
 * prefers-color-scheme do CSS volta a mandar, e a tela acompanha se o
 * sistema trocar de tema com o app aberto.
 */
function aplicar(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === "sistema") raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", tema === "escuro" ? "dark" : "light");
}

function lerSalvo(): Tema {
  try {
    const t = localStorage.getItem(CHAVE_TEMA);
    if (t === "claro" || t === "escuro") return t;
  } catch {
    // Safari em navegação privada lança ao ler localStorage. Sem preferência
    // guardada o app continua funcionando — só segue o sistema.
  }
  return "sistema";
}

/* ------------------------------------------------------------------
   O tema é estado do NAVEGADOR, não do React: quem manda é o localStorage,
   e outra aba do app pode mudá-lo. Por isso useSyncExternalStore e não
   useState — é a API feita para ler uma fonte externa sem desencontro
   entre o que o servidor renderizou e o que o cliente encontra.
   ------------------------------------------------------------------ */

const ouvintes = new Set<() => void>();

function avisar() {
  for (const f of ouvintes) f();
}

/** Mudança vinda de OUTRA aba: o storage já mudou, falta refletir aqui. */
function aoStorage(e: StorageEvent) {
  // key null = localStorage.clear(); nesse caso também vale reavaliar.
  if (e.key !== null && e.key !== CHAVE_TEMA) return;
  aplicar(lerSalvo());
  avisar();
}

function inscrever(f: () => void) {
  if (ouvintes.size === 0) window.addEventListener("storage", aoStorage);
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
    if (ouvintes.size === 0) window.removeEventListener("storage", aoStorage);
  };
}

export function BotaoTema() {
  /* O terceiro argumento é o valor no servidor, onde não existe
     localStorage. "sistema" é o padrão certo: é o que o CSS faz sozinho
     quando nada foi escolhido, então o HTML do servidor já nasce coerente. */
  const tema = useSyncExternalStore(inscrever, lerSalvo, () => "sistema" as Tema);

  function trocar() {
    const proximo = CICLO[tema];
    aplicar(proximo);
    try {
      if (proximo === "sistema") localStorage.removeItem(CHAVE_TEMA);
      else localStorage.setItem(CHAVE_TEMA, proximo);
    } catch {
      // Sem persistência a troca ainda vale para esta sessão.
    }
    avisar();
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-tema"
      onClick={trocar}
      title={`${ROTULO[tema]} · clique para trocar`}
      aria-label={`${ROTULO[tema]}. Clique para trocar.`}
    >
      <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {tema === "claro" && (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6" />
          </>
        )}
        {tema === "escuro" && <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z" />}
        {tema === "sistema" && (
          <>
            <circle cx="12" cy="12" r="8.4" />
            {/* Metade preenchida: o "meio a meio" diz automático sem texto. */}
            <path d="M12 3.6a8.4 8.4 0 0 1 0 16.8Z" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </button>
  );
}
