"use client";

import type { MemberDTO, TripDTO } from "@/types";
import type { Status } from "@/lib/status";
import { BotaoPerigo } from "./BotaoPerigo";
import { CUR } from "./constantes";
import { Checklist } from "./Gastos";
import { DiarioField } from "./Diario";
import { Hospedagem } from "./Hospedagem";
import { NoDestino } from "./NoDestino";
import { PreViagem } from "./AntesDeSair";
import { STATUSES, STATUS_LABEL } from "@/lib/status";
import { centavosParaCampo, formatBRL, parseCentavos } from "@/lib/format";
import { feitos } from "@/lib/checklist";
import { formatarPeriodo, noites } from "@/lib/datas";
import { progresso } from "@/lib/pre-viagem";
import { totalGasto } from "@/lib/gastos";
import { useEffect, useRef, useState } from "react";


export type AbaId = "viagem" | "diario" | "gastos" | "destino" | "antes";

export const ABAS: ReadonlyArray<{ id: AbaId; rotulo: string }> = [
  { id: "viagem", rotulo: "Viagem" },
  { id: "diario", rotulo: "Diário" },
  { id: "gastos", rotulo: "Gastos" },
  { id: "destino", rotulo: "No destino" },
  { id: "antes", rotulo: "Antes de sair" },
];

/**
 * O número ao lado do rótulo da aba.
 *
 * Mostra o que falta, não o total: numa aba fechada, "3" querendo dizer
 * "três pendências" é informação; "10" querendo dizer "dez itens" é ruído.
 * Por isso some quando não há nada pendente.
 */

/**
 * O número ao lado do rótulo da aba.
 *
 * Mostra o que falta, não o total: numa aba fechada, "3" querendo dizer
 * "três pendências" é informação; "10" querendo dizer "dez itens" é ruído.
 * Por isso some quando não há nada pendente.
 */
export function contadorDaAba(id: AbaId, trip: TripDTO | null): string | null {
  if (!trip) return null;
  if (id === "gastos") {
    const faltam = trip.items.length - feitos(trip.items);
    return faltam > 0 ? String(faltam) : null;
  }
  if (id === "destino") {
    // Aqui o número é o que já foi gasto, não uma pendência: é o dado que a
    // pessoa quer de relance nesta seção.
    const total = totalGasto(trip.expenses);
    return total > 0 ? formatBRL(total) : null;
  }
  if (id === "antes") {
    const { feitas, total } = progresso(trip.preTasks);
    return total - feitas > 0 ? String(total - feitas) : null;
  }
  return null;
}

export function TripModal({
  trip,
  presetYear,
  abaInicial = "viagem",
  defaultPeople,
  membros,
  onClose,
  onSave,
  onDelete,
}: {
  trip: TripDTO | null;
  presetYear: number;
  /** Em que aba o modal abre. O painel de viagem em curso manda direto
      para "No destino", que e onde se lanca um gasto. */
  abaInicial?: AbaId;
  /** Quantas pessoas a viagem nova assume: o tamanho do quadro. */
  defaultPeople: number;
  membros: MemberDTO[];
  onClose: () => void;
  onSave: (id: string | null, body: Partial<TripDTO>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [dest, setDest] = useState(trip?.dest ?? "");
  const [whenText, setWhenText] = useState(trip?.whenText ?? "");
  const [year, setYear] = useState<number>(trip ? trip.year : presetYear);
  const [ida, setIda] = useState(trip?.startDate ?? "");
  const [stayName, setStayName] = useState(trip?.stayName ?? "");
  const [stayAddress, setStayAddress] = useState(trip?.stayAddress ?? "");
  const [stayLat, setStayLat] = useState<number | null>(trip?.stayLat ?? null);
  const [stayLng, setStayLng] = useState<number | null>(trip?.stayLng ?? null);
  const [volta, setVolta] = useState(trip?.endDate ?? "");
  const [status, setStatus] = useState<Status>(trip?.status ?? "IDEIA");
  const [budget, setBudget] = useState<string>(centavosParaCampo(trip?.budgetCents));
  const [note, setNote] = useState(trip?.note ?? "");
  const [people, setPeople] = useState<string>(
    String(trip ? trip.people : Math.max(1, defaultPeople)),
  );
  const [saving, setSaving] = useState(false);
  const [aba, setAba] = useState<AbaId>(abaInicial);
  const destRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => destRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const yearOptions: number[] = [];
  for (let y = CUR; y <= CUR + 4; y++) yearOptions.push(y);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dest.trim()) {
      // O campo pode estar numa aba escondida: traz a pessoa até ele em vez
      // de recusar o envio em silêncio.
      setAba("viagem");
      requestAnimationFrame(() => destRef.current?.focus());
      return;
    }
    setSaving(true);
    const body: Partial<TripDTO> = {
      dest: dest.trim(),
      whenText: whenText.trim(),
      year,
      status,
      // Data vazia vai como null, não como "": o schema espera AAAA-MM-DD ou
      // nulo, e string vazia seria recusada.
      startDate: ida || null,
      endDate: volta || null,
      budgetCents: parseCentavos(budget),
      people: Math.min(50, Math.max(1, Math.round(Number(people) || 1))),
      note: note.trim(),
      stayName: stayName.trim(),
      stayAddress: stayAddress.trim(),
      stayLat,
      stayLng,
    };
    try {
      await onSave(trip?.id ?? null, body);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit}>
        <h3>{trip ? "Editar viagem" : "Nova viagem"}</h3>
        <div className="sub">{trip ? trip.dest : "Pra onde vocês querem ir?"}</div>

        {/* O modal virou quatro abas. Antes era uma coluna só, e já rolava
            1,8x a tela no celular — com as tarefas de antes de sair (e com o
            mapa e as atividades que vêm depois) viraria um formulário
            impossível de percorrer. As abas também dão um lugar definido
            para cada módulo novo, em vez de empilhar tudo no fim. */}
        <nav className="sheet-abas" aria-label="Seções da viagem">
          {ABAS.map((a) => {
            const marcador = contadorDaAba(a.id, trip);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={aba === a.id}
                onClick={() => setAba(a.id)}
              >
                {a.rotulo}
                {marcador && <span className="n">{marcador}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sheet-corpo">
        {aba === "viagem" && (
          <>

          <div className="field">
            <label htmlFor="t-dest">Destino</label>
            <input
              id="t-dest"
              ref={destRef}
              type="text"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="Fernando de Noronha, Lisboa, Chapada…"
              autoComplete="off"
              required
            />
          </div>

          <div className="two">
            <div className="field">
              <label htmlFor="t-when">Quando (época)</label>
              <input
                id="t-when"
                type="text"
                value={whenText}
                onChange={(e) => setWhenText(e.target.value)}
                placeholder="Julho, Carnaval, verão…"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="t-year">Ano</label>
              {/* Com data de ida preenchida o ano deixa de ser escolha: vem
                  dela. Manter os dois editáveis permitiria uma viagem marcada
                  para março de 2027 aparecer na faixa de 2026. */}
              <select
                id="t-year"
                value={ida ? Number(ida.slice(0, 4)) : year}
                disabled={!!ida}
                title={ida ? "Vem da data de ida" : undefined}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
                <option value={0}>Algum dia / sem data</option>
              </select>
            </div>
          </div>

          <div className="two">
            <div className="field">
              <label htmlFor="t-ida">Ida (se já souber)</label>
              <input
                id="t-ida"
                type="date"
                value={ida}
                onChange={(e) => {
                  const v = e.target.value;
                  setIda(v);
                  // Volta antes da ida não faz sentido; em vez de recusar
                  // depois, ajusto na hora.
                  if (v && volta && volta < v) setVolta(v);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="t-volta">Volta</label>
              <input
                id="t-volta"
                type="date"
                value={volta}
                min={ida || undefined}
                disabled={!ida}
                title={!ida ? "Preencha a ida primeiro" : undefined}
                onChange={(e) => setVolta(e.target.value)}
              />
            </div>
          </div>

          {ida && (
            <p className="dica-datas">
              {formatarPeriodo(ida, volta || null)}
              {noites(ida, volta || null) != null &&
                noites(ida, volta || null)! > 0 &&
                ` · ${noites(ida, volta || null)} noites`}
            </p>
          )}

          <div className="field">
            <label>Status</label>
            <div className="seg">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`p-${s}`}
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                >
                  <span className="sd" />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="two">
            <div className="field">
              <label htmlFor="t-budget">Orçamento · por pessoa (R$)</label>
              {/* type="text", não "number": o input numérico do navegador
                  rejeita vírgula, e ninguém escreve "2190.47" em português.
                  O inputMode abre o teclado numérico no celular assim mesmo. */}
              <input
                id="t-budget"
                type="text"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="ex: 2500 ou 2190,47"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="t-people">Quantas pessoas</label>
              <input
                id="t-people"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {/* O total só aparece quando muda alguma coisa: com 1 pessoa ele
              seria igual ao orçamento e viraria ruído. */}
          {Number(people) > 1 && (parseCentavos(budget) ?? 0) > 0 && (
            <p className="total-viagem">
              {people} × {formatBRL(parseCentavos(budget))} ={" "}
              <b>{formatBRL((parseCentavos(budget) ?? 0) * Number(people))}</b> no
              total
            </p>
          )}

          <Hospedagem
            nome={stayName}
            endereco={stayAddress}
            lat={stayLat}
            lng={stayLng}
            onNome={setStayName}
            onEndereco={setStayAddress}
            onPonto={(la, ln) => {
              setStayLat(la);
              setStayLng(ln);
            }}
          />
          </>
        )}

        {aba === "diario" && (
          <>
          <DiarioField valor={note} onChange={setNote} />
          </>
        )}

        {aba === "gastos" && (
          <>
        {/* O checklist tem ids próprios no banco, então precisa da viagem já
              criada para pendurar os itens. Em viagem nova ele aparece como
              aviso em vez de sumir: assim a pessoa sabe que existe. */}
          {trip ? (
            <Checklist
              tripId={trip.id}
              initial={trip.items}
              budgetCents={trip.budgetCents}
              membros={membros}
              people={Math.max(1, Number(people) || 1)}
              gastos={trip.expenses}
            />
          ) : (
            <div className="field">
              <label>Checklist</label>
              <p className="check-vazio">
                Salve a viagem e o checklist abre aqui — aí você lança passagem,
                hospedagem e os valores reais de cada um.
              </p>
            </div>
          )}
          </>
        )}

        {aba === "destino" &&
          (trip ? (
            <NoDestino
              tripId={trip.id}
              atividades={trip.activities}
              gastosIniciais={trip.expenses}
              membros={membros}
              people={Math.max(1, Number(people) || 1)}
              dias={noites(ida || null, volta || null)}
            />
          ) : (
            <div className="field">
              <label>No destino</label>
              <p className="check-vazio">
                Salve a viagem e aqui entram os passeios, com contato, e os
                gastos do dia a dia.
              </p>
            </div>
          ))}

        {aba === "antes" &&
          (trip ? (
            <PreViagem tripId={trip.id} initial={trip.preTasks} />
          ) : (
            <div className="field">
              <label>Antes de sair</label>
              <p className="check-vazio">
                Salve a viagem e a lista de antes de sair aparece aqui, já
                preenchida com a rotina de fechar a casa.
              </p>
            </div>
          ))}
        </div>

        <div className="sheet-actions">
          {trip && (
            <BotaoPerigo
              label="Excluir"
              confirmLabel="Excluir mesmo?"
              onConfirm={() => void onDelete(trip.id)}
              title="Apaga a viagem e todo o checklist dela"
            />
          )}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Modal de compartilhamento (membros + convites)
   ============================================================ */
