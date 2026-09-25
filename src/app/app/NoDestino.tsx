"use client";

import { api } from "@/lib/api-cliente";
import type { ActivityDTO, ActivityStatus, ExpenseCategory, ExpenseDTO, MemberDTO } from "@/types";
import { CATEGORIAS, CATEGORIA_LABEL, mediaPorDia, porCategoria, totalGasto } from "@/lib/gastos";
import { centavosParaCampo, formatBRL, parseCentavos } from "@/lib/format";
import { porPessoa as gastoPorPessoa } from "@/lib/gastos";
import { useState } from "react";


export function NoDestino({
  tripId,
  atividades,
  gastosIniciais,
  membros,
  people,
  dias,
}: {
  tripId: string;
  atividades: ActivityDTO[];
  gastosIniciais: ExpenseDTO[];
  membros: MemberDTO[];
  people: number;
  dias: number | null;
}) {
  return (
    <>
      <Atividades tripId={tripId} initial={atividades} />
      <GastosAvulsos
        tripId={tripId}
        initial={gastosIniciais}
        membros={membros}
        people={people}
        dias={dias}
      />
    </>
  );
}

export const STATUS_ATIV: Record<ActivityStatus, string> = {
  IDEIA: "Ideia",
  AGENDADO: "Agendado",
  FEITO: "Feito",
};

export const CICLO_ATIV: ActivityStatus[] = ["IDEIA", "AGENDADO", "FEITO"];

export function Atividades({ tripId, initial }: { tripId: string; initial: ActivityDTO[] }) {
  const [lista, setLista] = useState<ActivityDTO[]>(initial);
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);


  async function adicionar() {
    const label = nova.trim();
    if (!label) return;
    setErro(null);
    try {
      const { activity } = await api<{ activity: ActivityDTO }>(
        `/api/trips/${tripId}/activities`,
        { method: "POST", body: JSON.stringify({ label }) },
      );
      setLista((p) => [...p, activity]);
      setNova("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para adicionar");
    }
  }

  async function atualizar(id: string, patch: Partial<ActivityDTO>) {
    const antes = lista;
    setLista((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setErro(null);
    try {
      await api(`/api/activities/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    } catch (e) {
      setLista(antes);
      setErro(e instanceof Error ? e.message : "Não deu para salvar");
    }
  }

  async function remover(id: string) {
    const antes = lista;
    setLista((p) => p.filter((a) => a.id !== id));
    try {
      await api(`/api/activities/${id}`, { method: "DELETE" });
    } catch {
      setLista(antes);
      setErro("Não deu para excluir");
    }
  }

  return (
    <div className="field">
      <label>Passeios e atividades</label>

      {lista.length === 0 && (
        <p className="check-vazio">
          Barco, quadriciclo, trilha — com o telefone de quem organiza.
        </p>
      )}

      {lista.map((a) => (
        <AtividadeCard
          key={a.id}
          ativ={a}
          onCiclo={() =>
            atualizar(a.id, {
              status: CICLO_ATIV[(CICLO_ATIV.indexOf(a.status) + 1) % CICLO_ATIV.length],
            })
          }
          onCommit={(patch) => atualizar(a.id, patch)}
          onRemove={() => remover(a.id)}
        />
      ))}

      <div className="check-novo" style={{ marginTop: 8 }}>
        <input
          type="text"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void adicionar();
            }
          }}
          placeholder="Passeio de barco, quadriciclo…"
          autoComplete="off"
          aria-label="Nova atividade"
        />
        <button type="button" className="btn" onClick={() => void adicionar()} disabled={!nova.trim()}>
          Adicionar
        </button>
      </div>

      {erro && <p className="check-erro">{erro}</p>}
    </div>
  );
}

export function AtividadeCard({
  ativ,
  onCiclo,
  onCommit,
  onRemove,
}: {
  ativ: ActivityDTO;
  onCiclo: () => void;
  onCommit: (patch: Partial<ActivityDTO>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(ativ.label);
  const [contato, setContato] = useState(ativ.contact);
  const [quando, setQuando] = useState(ativ.whenAt ?? "");
  const [hora, setHora] = useState(ativ.timeText);

  const [visto, setVisto] = useState(ativ);
  if (visto !== ativ) {
    setVisto(ativ);
    setLabel(ativ.label);
    setContato(ativ.contact);
    setQuando(ativ.whenAt ?? "");
    setHora(ativ.timeText);
  }

  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  /* O telefone vira link de discagem: o motivo de existir este campo é
     alguém precisar ligar para o barqueiro estando na praia, com uma mão só. */
  const telefone = ativ.contact.replace(/[^\d+]/g, "");
  const discavel = telefone.length >= 8;

  return (
    <div className={`ativ s-${ativ.status}`}>
      <div className="ativ-l1">
        <button
          type="button"
          className={`ativ-status s-${ativ.status}`}
          onClick={onCiclo}
          title="Avançar situação"
          aria-label={`Situação: ${STATUS_ATIV[ativ.status]}. Clique para avançar`}
        >
          {STATUS_ATIV[ativ.status]}
        </button>
        <input
          className="campo ativ-txt"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            const v = label.trim();
            if (!v) return setLabel(ativ.label);
            if (v !== ativ.label) onCommit({ label: v });
          }}
          onKeyDown={enter}
          autoComplete="off"
          aria-label={`Nome: ${ativ.label}`}
        />
        <button
          type="button"
          className="check-del"
          onClick={onRemove}
          aria-label={`Excluir ${ativ.label}`}
          title="Excluir"
        >
          ×
        </button>
      </div>

      <div className="ativ-l2">
        <input
          className="campo"
          type="text"
          value={contato}
          onChange={(e) => setContato(e.target.value)}
          onBlur={() => contato.trim() !== ativ.contact && onCommit({ contact: contato.trim() })}
          onKeyDown={enter}
          placeholder="quem organiza · telefone"
          autoComplete="off"
          aria-label={`Contato de ${ativ.label}`}
        />
        <input
          className="campo"
          type="date"
          value={quando}
          onChange={(e) => {
            setQuando(e.target.value);
            onCommit({ whenAt: e.target.value || null });
          }}
          aria-label={`Data de ${ativ.label}`}
        />
        <input
          className="campo"
          type="text"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          onBlur={() => hora.trim() !== ativ.timeText && onCommit({ timeText: hora.trim() })}
          onKeyDown={enter}
          placeholder="9h, manhã…"
          autoComplete="off"
          aria-label={`Horário de ${ativ.label}`}
        />
      </div>

      {discavel && (
        <a className="ativ-tel" href={`tel:${telefone}`}>
          Ligar para {ativ.contact}
        </a>
      )}
    </div>
  );
}

/* Gastos avulsos: o registro corrido do dia a dia. O resumo por categoria
   vem primeiro de propósito — é a resposta para "para onde foi o dinheiro",
   que é a pergunta que faz o módulo existir. */

export function GastosAvulsos({
  tripId,
  initial,
  membros,
  people,
  dias,
}: {
  tripId: string;
  initial: ExpenseDTO[];
  membros: MemberDTO[];
  people: number;
  dias: number | null;
}) {
  const [lista, setLista] = useState<ExpenseDTO[]>(initial);
  const [label, setLabel] = useState("");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState<ExpenseCategory>("TRANSPORTE");
  const [erro, setErro] = useState<string | null>(null);

  const total = totalGasto(lista);
  const fatias = porCategoria(lista);
  const porCabeca = gastoPorPessoa(lista, people);
  const media = mediaPorDia(lista, dias);
  const compartilhado = membros.length > 1;


  async function adicionar() {
    const nome = label.trim();
    const centavos = parseCentavos(valor);
    if (!nome || !centavos || centavos <= 0) {
      setErro("Informe o que foi e quanto custou");
      return;
    }
    setErro(null);
    try {
      const { expense } = await api<{ expense: ExpenseDTO }>(
        `/api/trips/${tripId}/expenses`,
        {
          method: "POST",
          body: JSON.stringify({ label: nome, totalCents: centavos, category: cat }),
        },
      );
      setLista((p) => [...p, expense]);
      setLabel("");
      setValor("");
      // A categoria NÃO é resetada: quem está lançando cinco Ubers seguidos
      // não quer reescolher "transporte" cinco vezes.
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para lançar");
    }
  }

  async function atualizar(id: string, patch: Partial<ExpenseDTO>) {
    const antes = lista;
    setLista((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    setErro(null);
    try {
      await api(`/api/expenses/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    } catch (e) {
      setLista(antes);
      setErro(e instanceof Error ? e.message : "Não deu para salvar");
    }
  }

  async function remover(id: string) {
    const antes = lista;
    setLista((p) => p.filter((g) => g.id !== id));
    try {
      await api(`/api/expenses/${id}`, { method: "DELETE" });
    } catch {
      setLista(antes);
      setErro("Não deu para excluir");
    }
  }

  return (
    <div className="field">
      <div className="pre-topo">
        <label className="rotulo">Gastos por aqui</label>
        {total > 0 && <span className="gasto-total">{formatBRL(total)}</span>}
      </div>

      {fatias.length > 0 && (
        <div className="gasto-fatias">
          {fatias.map((f) => (
            <div className="fatia" key={f.categoria}>
              <span className="nome">{CATEGORIA_LABEL[f.categoria]}</span>
              <span className="barra">
                <span className={`fill c-${f.categoria}`} style={{ width: `${f.pct}%` }} />
              </span>
              <span className="valor">{formatBRL(f.total)}</span>
            </div>
          ))}
          <p className="gasto-nota">
            {people > 1 && <>{formatBRL(porCabeca)} por pessoa</>}
            {people > 1 && media != null && " · "}
            {media != null && <>{formatBRL(media)} por dia</>}
          </p>
        </div>
      )}

      {lista.map((g) => (
        <GastoLinha
          key={g.id}
          gasto={g}
          membros={compartilhado ? membros : []}
          onCommit={(patch) => atualizar(g.id, patch)}
          onRemove={() => remover(g.id)}
        />
      ))}

      <div className="gasto-novo">
        <select
          className="campo"
          value={cat}
          onChange={(e) => setCat(e.target.value as ExpenseCategory)}
          aria-label="Categoria do gasto"
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          className="campo"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void adicionar();
            }
          }}
          placeholder="Uber pro centro"
          autoComplete="off"
          aria-label="O que foi o gasto"
        />
        <input
          className="campo"
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void adicionar();
            }
          }}
          placeholder="R$"
          autoComplete="off"
          aria-label="Quanto custou"
        />
        <button type="button" className="btn" onClick={() => void adicionar()}>
          Lançar
        </button>
      </div>

      {erro && <p className="check-erro">{erro}</p>}
    </div>
  );
}

export function GastoLinha({
  gasto,
  membros,
  onCommit,
  onRemove,
}: {
  gasto: ExpenseDTO;
  membros: MemberDTO[];
  onCommit: (patch: Partial<ExpenseDTO>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(gasto.label);
  const [valor, setValor] = useState(centavosParaCampo(gasto.totalCents));

  const [visto, setVisto] = useState(gasto);
  if (visto !== gasto) {
    setVisto(gasto);
    setLabel(gasto.label);
    setValor(centavosParaCampo(gasto.totalCents));
  }

  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="gasto-linha">
      <span className={`gasto-tag c-${gasto.category}`} title={CATEGORIA_LABEL[gasto.category]}>
        {CATEGORIA_LABEL[gasto.category].slice(0, 3)}
      </span>
      <input
        className="campo gasto-txt"
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          const v = label.trim();
          if (!v) return setLabel(gasto.label);
          if (v !== gasto.label) onCommit({ label: v });
        }}
        onKeyDown={enter}
        autoComplete="off"
        aria-label={`Gasto: ${gasto.label}`}
      />
      {membros.length > 1 && (
        <select
          className="campo gasto-quem"
          value={gasto.paidById ?? ""}
          onChange={(e) => onCommit({ paidById: e.target.value || null })}
          aria-label={`Quem pagou ${gasto.label}`}
        >
          <option value="">quem?</option>
          {membros.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name.trim().split(/\s+/)[0]}
            </option>
          ))}
        </select>
      )}
      <input
        className="campo gasto-val"
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          const n = parseCentavos(valor);
          if (n && n > 0 && n !== gasto.totalCents) onCommit({ totalCents: n });
          else if (!n) setValor(centavosParaCampo(gasto.totalCents));
        }}
        onKeyDown={enter}
        aria-label={`Valor de ${gasto.label}`}
      />
      <button
        type="button"
        className="check-del"
        onClick={onRemove}
        aria-label={`Excluir ${gasto.label}`}
        title="Excluir"
      >
        ×
      </button>
    </div>
  );
}

/* ============================================================
   Hospedagem

   Três formas de marcar o lugar, porque cada uma falha de um jeito:
   buscar o endereço (não acha casa de gente), colar a coordenada (é o que o
   Google Maps e o WhatsApp dão) e arrastar o pino (conserta o que a busca
   errou por uma quadra).
   ============================================================ */
