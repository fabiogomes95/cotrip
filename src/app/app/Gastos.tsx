"use client";

import { api } from "@/lib/api-cliente";
import type { ChecklistItemDTO, ExpenseDTO, MemberDTO } from "@/types";
import { Acerto } from "./Acerto";
import { centavosParaCampo, formatBRL, parseCentavos } from "@/lib/format";
import { compararComOrcamento, feitos, totalAPagar, totalContratado, totalPago } from "@/lib/checklist";
import { faltaCents, pagoCents, parcelasRestantes, proximoVencimento, valorEntrada, valorParcela } from "@/lib/parcelas";
import { formatarPeriodo } from "@/lib/datas";
import { useState } from "react";


export function Checklist({
  tripId,
  initial,
  budgetCents,
  membros,
  people,
  gastos,
}: {
  tripId: string;
  initial: ChecklistItemDTO[];
  budgetCents: number | null;
  membros: MemberDTO[];
  people: number;
  /** Gastos avulsos entram no acerto junto com o checklist. */
  gastos: ExpenseDTO[];
}) {
  // Acerto de contas só existe em quadro com mais de uma pessoa: sozinho,
  // você não deve nada a ninguém.
  const compartilhado = membros.length > 1;
  const [items, setItems] = useState<ChecklistItemDTO[]>(initial);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ok = feitos(items);
  const contratado = totalContratado(items);
  const pago = totalPago(items);
  const aPagar = totalAPagar(items);


  async function adicionar() {
    const label = novo.trim();
    if (!label || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const { item } = await api<{ item: ChecklistItemDTO }>(
        `/api/trips/${tripId}/items`,
        { method: "POST", body: JSON.stringify({ label }) },
      );
      setItems((prev) => [...prev, item]);
      setNovo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para adicionar");
    } finally {
      setOcupado(false);
    }
  }

  // Otimista: a tela muda na hora e volta ao estado anterior se a API recusar.
  // Guardo `antes` em vez de tentar desfazer o patch — é à prova de cliques
  // rápidos em sequência.
  async function atualizar(id: string, patch: Partial<ChecklistItemDTO>) {
    const antes = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setErro(null);
    try {
      await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    } catch (e) {
      setItems(antes);
      setErro(e instanceof Error ? e.message : "Não deu para salvar");
    }
  }

  async function remover(id: string) {
    const antes = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setErro(null);
    try {
      await api(`/api/items/${id}`, { method: "DELETE" });
    } catch {
      setItems(antes);
      setErro("Não deu para excluir");
    }
  }

  // Comparação com a estimativa — o ponto da funcionalidade toda.
  const comparacao = compararComOrcamento(contratado, budgetCents);
  const veredito = comparacao
    ? {
        txt: comparacao.acima
          ? `${formatBRL(comparacao.diferenca)} acima do estimado`
          : comparacao.diferenca === 0
            ? "bateu o estimado na mosca"
            : `${formatBRL(comparacao.diferenca)} abaixo`,
        acima: comparacao.acima,
      }
    : null;

  return (
    <div className="field">
      <label>Checklist · valores reais</label>

      {items.length > 0 && (
        <div className="check-lista">
          {items.map((item) => (
            <ChecklistLinha
              key={item.id}
              item={item}
              membros={compartilhado ? membros : []}
              onToggle={() => atualizar(item.id, { done: !item.done })}
              onCommit={(patch) => atualizar(item.id, patch)}
              onRemove={() => remover(item.id)}
            />
          ))}
        </div>
      )}

      <div className="check-novo">
        <input
          className="campo"
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            // Enter aqui adiciona o item. O preventDefault é essencial:
            // sem ele o Enter submeteria o formulário da viagem inteira.
            if (e.key === "Enter") {
              e.preventDefault();
              void adicionar();
            }
          }}
          placeholder="Passagem, hospedagem, seguro…"
          autoComplete="off"
          aria-label="Novo item do checklist"
        />
        <button
          type="button"
          className="btn"
          onClick={() => void adicionar()}
          disabled={ocupado || !novo.trim()}
        >
          Adicionar
        </button>
      </div>

      {erro && <p className="check-erro">{erro}</p>}

      {items.length > 0 && (
        <div className="check-soma">
          <span>
            {ok} de {items.length} contratado{items.length === 1 ? "" : "s"}
          </span>
          <span className="grow" />
          <span>
            {contratado > 0 ? (
              <>
                <b>{formatBRL(contratado)}</b> contratado
                {budgetCents && budgetCents > 0
                  ? ` de ${formatBRL(budgetCents)}`
                  : ""}
              </>
            ) : (
              "nada contratado ainda"
            )}
          </span>
        </div>
      )}

      {/* Pago e a pagar ficam numa linha própria: são a resposta para "quanto
          ainda vai sair do bolso", que é diferente de "quanto essa viagem
          custa". Só aparece quando há parcelamento ou pagamento em curso. */}
      {(pago > 0 || aPagar > 0) && (
        <div className="check-soma pagamento">
          <span>
            <b>{formatBRL(pago)}</b> já pagos
          </span>
          <span className="grow" />
          <span className={aPagar > 0 ? "falta" : undefined}>
            {aPagar > 0 ? <>faltam {formatBRL(aPagar)}</> : "tudo quitado ✦"}
          </span>
        </div>
      )}

      {veredito && (
        <p className={`check-veredito${veredito.acima ? " acima" : ""}`}>{veredito.txt}</p>
      )}

      {compartilhado && pago > 0 && (
        <Acerto items={items} gastos={gastos} membros={membros} people={people} />
      )}
    </div>
  );
}

/* Uma linha do checklist. O rascunho de texto e valor fica aqui, local, e só
   sobe para a API no blur (ou no Enter) — senão seria uma requisição por
   tecla digitada. */

export function ChecklistLinha({
  item,
  membros,
  onToggle,
  onCommit,
  onRemove,
}: {
  item: ChecklistItemDTO;
  /** Vazio em quadro solo: aí não existe "quem pagou". */
  membros: MemberDTO[];
  onToggle: () => void;
  onCommit: (patch: Partial<ChecklistItemDTO>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [valor, setValor] = useState(centavosParaCampo(item.amountCents));

  /* Se o item mudar por fora (um rollback depois de erro na API), o rascunho
     precisa acompanhar — senão a tela segue mostrando um valor que não foi
     salvo. O padrão aqui é o "ajustar estado durante o render" documentado
     pelo React: comparar com o valor anterior e corrigir na hora. Fazer isso
     num useEffect renderizaria duas vezes e mostraria o valor errado no meio. */
  const [visto, setVisto] = useState(item);
  if (visto !== item) {
    setVisto(item);
    setLabel(item.label);
    setValor(centavosParaCampo(item.amountCents));
  }

  const [abrirPag, setAbrirPag] = useState(false);

  function gravarLabel() {
    const v = label.trim();
    if (!v) {
      setLabel(item.label); // apagar tudo não vira item sem nome: desfaz
      return;
    }
    if (v !== item.label) onCommit({ label: v });
  }

  function gravarValor() {
    const n = parseCentavos(valor);
    if (n !== item.amountCents) onCommit({ amountCents: n });
  }

  return (
    <div className={`check-item${item.done ? " feito" : ""}`}>
      <div className="check-linha">
      <button
        type="button"
        className="check-box"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.label}
        onClick={onToggle}
      >
        <span aria-hidden="true">{item.done ? "✓" : ""}</span>
      </button>

      <input
        className="campo check-txt"
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={gravarLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        autoComplete="off"
        aria-label={`Nome do item ${item.label}`}
      />

      <span className="check-cifrao">R$</span>
      <input
        className="campo check-val"
        // Mesmo motivo do campo de orçamento: "number" não aceita vírgula, e
        // gasto real quase nunca é número redondo.
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={gravarValor}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="—"
        aria-label={`Valor real de ${item.label}`}
      />

      <button
        type="button"
        className="check-del"
        onClick={onRemove}
        aria-label={`Excluir ${item.label}`}
        title="Excluir item"
      >
        ×
      </button>
      </div>

      {/* O pagamento só faz sentido depois que existe um valor. Antes disso a
          linha extra seria ruído em cinco itens ainda em branco. */}
      {(item.amountCents ?? 0) > 0 && (
        <>
          <button
            type="button"
            className="check-pag-abrir"
            aria-expanded={abrirPag}
            onClick={() => setAbrirPag((v) => !v)}
          >
            {resumoPagamento(item)}
            <span className="seta" aria-hidden="true">
              {abrirPag ? "▴" : "▾"}
            </span>
          </button>

          {abrirPag && (
            <PainelPagamento item={item} membros={membros} onCommit={onCommit} />
          )}
        </>
      )}
    </div>
  );
}

/** A frase curta que resume o pagamento do item, no botão que abre o painel. */

/** A frase curta que resume o pagamento do item, no botão que abre o painel. */
export function resumoPagamento(item: ChecklistItemDTO): string {
  if (faltaCents(item) === 0) return "pago";

  const entrada = valorEntrada(item);
  const restantes = parcelasRestantes(item);
  const partes: string[] = [];

  if (entrada > 0) {
    partes.push(
      `entrada ${formatBRL(entrada)}${item.downPaymentPaid ? "" : " (a pagar)"}`,
    );
  }

  if (restantes > 0 || item.paidInstallments > 0) {
    if (item.installments > 1) {
      partes.push(`${item.installments}× de ${formatBRL(valorParcela(item))}`);
      if (item.paidInstallments > 0) {
        partes.push(
          `${item.paidInstallments} paga${item.paidInstallments === 1 ? "" : "s"}`,
        );
      }
    } else if (entrada === 0) {
      partes.push("à vista");
    }
  }

  const venc = proximoVencimento(item);
  if (venc) partes.push(`próxima ${formatarPeriodo(venc, null)}`);
  else if (partes.length === 0) partes.push("a pagar");

  return partes.join(" · ");
}

/** Controles de parcelamento de um item. */

/** Controles de parcelamento de um item. */
export function PainelPagamento({
  item,
  membros,
  onCommit,
}: {
  item: ChecklistItemDTO;
  membros: MemberDTO[];
  onCommit: (patch: Partial<ChecklistItemDTO>) => void;
}) {
  const pagas = item.paidInstallments;
  const n = item.installments;
  const entrada = valorEntrada(item);

  // Rascunho local da entrada, como nos outros campos de dinheiro: só sobe
  // para a API no blur, senão seria uma requisição por tecla.
  const [rascunhoEntrada, setRascunhoEntrada] = useState(
    centavosParaCampo(item.downPaymentCents),
  );
  const [vistoEnt, setVistoEnt] = useState(item.downPaymentCents);
  if (vistoEnt !== item.downPaymentCents) {
    setVistoEnt(item.downPaymentCents);
    setRascunhoEntrada(centavosParaCampo(item.downPaymentCents));
  }

  function gravarEntrada() {
    const v = parseCentavos(rascunhoEntrada);
    if (v === item.downPaymentCents) return;
    // Quem digita uma entrada normalmente já a pagou — é o gesto de registrar
    // uma compra feita. Fica marcada, e dá para desmarcar ao lado.
    onCommit({
      downPaymentCents: v,
      ...(v && v > 0 && !item.downPaymentPaid ? { downPaymentPaid: true } : {}),
      ...(v === null ? { downPaymentPaid: false } : {}),
    });
  }

  return (
    <div className="check-pag">
      <div className="linha">
        <label className="rotulo" htmlFor={`p-e-${item.id}`}>Entrada</label>
        <div className="entrada">
          <input
            className="campo"
            id={`p-e-${item.id}`}
            type="text"
            inputMode="decimal"
            value={rascunhoEntrada}
            onChange={(e) => setRascunhoEntrada(e.target.value)}
            onBlur={gravarEntrada}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="sem entrada"
            autoComplete="off"
          />
          {entrada > 0 && (
            <label className="ja-paga">
              <input
                type="checkbox"
                checked={item.downPaymentPaid}
                onChange={(e) => onCommit({ downPaymentPaid: e.target.checked })}
              />
              já paga
            </label>
          )}
        </div>
      </div>

      <div className="linha">
        <label className="rotulo" htmlFor={`p-n-${item.id}`}>
          {entrada > 0 ? "Restante em quantas vezes" : "Em quantas vezes"}
        </label>
        <input
          className="campo"
          id={`p-n-${item.id}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={n}
          onChange={(e) => {
            const v = Math.min(60, Math.max(1, Math.round(Number(e.target.value) || 1)));
            // Reduzir o número de parcelas não pode deixar "5 pagas de 3".
            onCommit({ installments: v, paidInstallments: Math.min(pagas, v) });
          }}
        />
      </div>

      <div className="linha">
        <span className="rot">Parcelas pagas</span>
        <div className="contador">
          <button
            type="button"
            onClick={() => onCommit({ paidInstallments: Math.max(0, pagas - 1) })}
            disabled={pagas <= 0}
            aria-label="Uma parcela a menos"
          >
            −
          </button>
          <span className="n">
            {pagas} / {n}
          </span>
          <button
            type="button"
            onClick={() => onCommit({ paidInstallments: Math.min(n, pagas + 1) })}
            disabled={pagas >= n}
            aria-label="Mais uma parcela paga"
          >
            +
          </button>
        </div>
      </div>

      <div className="linha">
        <label className="rotulo" htmlFor={`p-d-${item.id}`}>Primeira vence em</label>
        <input
          className="campo"
          id={`p-d-${item.id}`}
          type="date"
          value={item.firstDueDate ?? ""}
          onChange={(e) => onCommit({ firstDueDate: e.target.value || null })}
        />
      </div>

      {membros.length > 1 && (
        <div className="linha">
          <label className="rotulo" htmlFor={`p-q-${item.id}`}>Quem pagou</label>
          <select
            className="campo"
            id={`p-q-${item.id}`}
            value={item.paidById ?? ""}
            onChange={(e) => onCommit({ paidById: e.target.value || null })}
          >
            <option value="">—</option>
            {membros.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="resumo">
        {entrada > 0 && (
          <span className="conta">
            {formatBRL(entrada)} de entrada + {n}× de {formatBRL(valorParcela(item))}
            <br />
          </span>
        )}
        <b>{formatBRL(pagoCents(item))}</b> pagos ·{" "}
        {faltaCents(item) > 0 ? (
          <>faltam {formatBRL(faltaCents(item))}</>
        ) : (
          "quitado"
        )}
      </p>
    </div>
  );
}

/* ============================================================
   Checklist no cartão

   Mostra os 3 primeiros itens e um "+ mais N" que abre o resto ali mesmo,
   sem sair do quadro. O corte em 3 é o que mantém os cartões com alturas
   parecidas — com a lista inteira sempre aberta, uma viagem de 8 itens
   deixaria a grade toda desalinhada.
   ============================================================ */
