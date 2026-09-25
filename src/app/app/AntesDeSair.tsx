"use client";

import { api } from "@/lib/api-cliente";
import type { PreTaskDTO, PreTripWhen } from "@/types";
import { MOMENTOS, MOMENTO_LABEL, agruparPorMomento, pendenciasPorPessoa, progresso } from "@/lib/pre-viagem";
import { useState } from "react";


export function PreViagem({
  tripId,
  initial,
}: {
  tripId: string;
  initial: PreTaskDTO[];
}) {
  const [tarefas, setTarefas] = useState<PreTaskDTO[]>(initial);
  const [erro, setErro] = useState<string | null>(null);

  const { feitas, total, pct, tudoPronto } = progresso(tarefas);
  const grupos = agruparPorMomento(tarefas);
  const pendencias = pendenciasPorPessoa(tarefas);


  async function adicionar(label: string, when: PreTripWhen) {
    setErro(null);
    try {
      const { task } = await api<{ task: PreTaskDTO }>(`/api/trips/${tripId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ label, when }),
      });
      setTarefas((prev) => [...prev, task]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para adicionar");
    }
  }

  // Otimista, guardando o estado anterior inteiro: é à prova de cliques
  // rápidos em sequência, que numa lista de dez tarefas acontecem sempre.
  async function atualizar(id: string, patch: Partial<PreTaskDTO>) {
    const antes = tarefas;
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setErro(null);
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    } catch (e) {
      setTarefas(antes);
      setErro(e instanceof Error ? e.message : "Não deu para salvar");
    }
  }

  async function remover(id: string) {
    const antes = tarefas;
    setTarefas((prev) => prev.filter((t) => t.id !== id));
    setErro(null);
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
    } catch {
      setTarefas(antes);
      setErro("Não deu para excluir");
    }
  }

  return (
    <div className="field">
      <div className="pre-topo">
        <label className="rotulo">Antes de sair</label>
        {total > 0 && (
          <span className={`pre-progresso${tudoPronto ? " pronto" : ""}`}>
            <span className="barra">
              <span className="fill" style={{ width: `${pct}%` }} />
            </span>
            {tudoPronto ? "tudo pronto ✦" : `${feitas}/${total}`}
          </span>
        )}
      </div>

      {MOMENTOS.map((momento) => {
        const grupo = grupos.find((g) => g.momento === momento);
        return (
          <div className="pre-grupo" key={momento}>
            <div className="pre-grupo-tit">{MOMENTO_LABEL[momento]}</div>
            {grupo?.tarefas.map((t) => (
              <PreLinha
                key={t.id}
                tarefa={t}
                onToggle={() => atualizar(t.id, { done: !t.done })}
                onCommit={(patch) => atualizar(t.id, patch)}
                onRemove={() => remover(t.id)}
              />
            ))}
            <NovaTarefa onAdd={(label) => void adicionar(label, momento)} />
          </div>
        );
      })}

      {erro && <p className="check-erro">{erro}</p>}

      {/* O resumo por pessoa é o motivo de existir o campo de responsável:
          serve para conferir de relance se combinou tudo com todo mundo. */}
      {pendencias.length > 0 && (
        <div className="pre-pendencias">
          <div className="tit">Combinado com</div>
          {pendencias.map((p) => (
            <div className="linha" key={p.pessoa}>
              <b>{p.pessoa}</b>
              <span>{p.tarefas.join(" · ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreLinha({
  tarefa,
  onToggle,
  onCommit,
  onRemove,
}: {
  tarefa: PreTaskDTO;
  onToggle: () => void;
  onCommit: (patch: Partial<PreTaskDTO>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(tarefa.label);
  const [quem, setQuem] = useState(tarefa.assignee);

  // Mesmo padrão das outras linhas editáveis: ajuste durante o render, para
  // o rascunho acompanhar um rollback sem renderizar duas vezes.
  const [visto, setVisto] = useState(tarefa);
  if (visto !== tarefa) {
    setVisto(tarefa);
    setLabel(tarefa.label);
    setQuem(tarefa.assignee);
  }

  function gravarLabel() {
    const v = label.trim();
    if (!v) {
      setLabel(tarefa.label); // apagar tudo não vira tarefa sem nome
      return;
    }
    if (v !== tarefa.label) onCommit({ label: v });
  }

  function gravarQuem() {
    const v = quem.trim();
    if (v !== tarefa.assignee) onCommit({ assignee: v });
  }

  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className={`pre-linha${tarefa.done ? " feita" : ""}`}>
      <button
        type="button"
        className="check-box"
        role="checkbox"
        aria-checked={tarefa.done}
        aria-label={tarefa.label}
        onClick={onToggle}
      >
        <span aria-hidden="true">{tarefa.done ? "✓" : ""}</span>
      </button>

      <input
        className="campo pre-txt"
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={gravarLabel}
        onKeyDown={enter}
        autoComplete="off"
        aria-label={`Tarefa: ${tarefa.label}`}
      />

      <input
        className="campo pre-quem"
        type="text"
        value={quem}
        onChange={(e) => setQuem(e.target.value)}
        onBlur={gravarQuem}
        onKeyDown={enter}
        placeholder="quem?"
        autoComplete="off"
        aria-label={`Responsável por ${tarefa.label}`}
      />

      <button
        type="button"
        className="check-del"
        onClick={onRemove}
        aria-label={`Excluir ${tarefa.label}`}
        title="Excluir tarefa"
      >
        ×
      </button>
    </div>
  );
}

/** Campo de adicionar, um por momento — o "quando" vem de onde se digitou. */

/** Campo de adicionar, um por momento — o "quando" vem de onde se digitou. */
export function NovaTarefa({ onAdd }: { onAdd: (label: string) => void }) {
  const [texto, setTexto] = useState("");

  function enviar() {
    const v = texto.trim();
    if (!v) return;
    onAdd(v);
    setTexto("");
  }

  return (
    <input
      className="campo pre-nova"
      type="text"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        // preventDefault é essencial: sem ele o Enter envia o formulário da
        // viagem inteira em vez de criar a tarefa.
        if (e.key === "Enter") {
          e.preventDefault();
          enviar();
        }
      }}
      onBlur={enviar}
      placeholder="+ adicionar"
      autoComplete="off"
      aria-label="Nova tarefa"
    />
  );
}

/* ============================================================
   No destino — passeios e gastos do dia a dia

   Duas listas com propósitos diferentes na mesma aba:

   - Atividades guardam o CONTATO. O telefone do barqueiro é o que some
     quando você precisa dele, não o preço.
   - Gastos avulsos existem para responder "para onde foi o dinheiro". São
     muitos e pequenos — R$ 22 aqui, R$ 31 ali — e só assustam somados por
     categoria, que é o resumo no topo da lista.
   ============================================================ */
