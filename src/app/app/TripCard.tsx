"use client";

import type { ChecklistItemDTO, TripDTO } from "@/types";
import { STATUS_LABEL } from "@/lib/status";
import { contagem, formatarPeriodo, noites } from "@/lib/datas";
import { feitos, totalAPagar, totalPago } from "@/lib/checklist";
import { formatBRL } from "@/lib/format";
import { paraTextoSimples } from "@/lib/markdown";
import { useState } from "react";


export function YearSection({
  title,
  someday,
  count,
  money,
  isLast,
  trips,
  showAdd,
  onAdd,
  onOpen,
  onCycle,
  onToggleItem,
  hoje,
}: {
  title: string;
  someday: boolean;
  count: number;
  money: string | null;
  isLast: boolean;
  trips: TripDTO[];
  showAdd: boolean;
  onAdd: () => void;
  onOpen: (t: TripDTO) => void;
  onCycle: (t: TripDTO) => void;
  onToggleItem: (i: ChecklistItemDTO) => void;
  hoje: Date | null;
}) {
  return (
    <section
      className={`year${someday ? " someday" : ""}`}
      style={isLast ? undefined : undefined}
    >
      <div className="rail">
        <span className="dot" />
      </div>
      <div className="year-body">
        <div className="year-head">
          <h2>{title}</h2>
          <span className="meta">
            {count
              ? `${count} ${count === 1 ? "viagem" : "viagens"}`
              : "nada por aqui ainda"}
            {money ? (
              <>
                {" · "}
                <b>{money}</b>
              </>
            ) : null}
          </span>
        </div>
        <div className="grid">
          {trips.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              onOpen={onOpen}
              onCycle={onCycle}
              onToggleItem={onToggleItem}
              hoje={hoje}
            />
          ))}
          {showAdd && (
            <button className="add-card" onClick={onAdd}>
              <span style={{ fontSize: "17px" }}>+</span> viagem em{" "}
              {someday ? "algum dia" : title}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Card de viagem
   ============================================================ */

export function TripCard({
  trip,
  onOpen,
  onCycle,
  onToggleItem,
  hoje,
}: {
  trip: TripDTO;
  onOpen: (t: TripDTO) => void;
  onCycle: (t: TripDTO) => void;
  onToggleItem: (i: ChecklistItemDTO) => void;
  hoje: Date | null;
}) {
  /* Datas exatas mandam: quando existem, substituem a época em texto livre.
     "12 a 19 de nov de 2026" diz mais que "Novembro · 2026". */
  const periodo = formatarPeriodo(trip.startDate, trip.endDate);
  const when =
    periodo ??
    ([trip.whenText, trip.year && trip.year > 0 ? trip.year : null]
      .filter(Boolean)
      .join(" · ") ||
      "algum dia");

  const quanto = hoje ? contagem(trip.startDate, trip.endDate, hoje) : null;
  const dias = noites(trip.startDate, trip.endDate);

  /* O cartão tem três zonas, e elas são <button> separados de propósito:
     antes o cartão inteiro era um botão só, e o checklist tinha ficado
     dentro dele — botão dentro de botão é HTML inválido e o clique na
     caixinha nunca chegaria a marcar o item, só abriria a viagem. */
  return (
    <article className={`trip s-${trip.status}`}>
      <button
        className={`status s-${trip.status}`}
        title="Avançar status"
        aria-label={`Status: ${STATUS_LABEL[trip.status]}. Clique para avançar`}
        onClick={() => onCycle(trip)}
      >
        <span className="sd" />
        {STATUS_LABEL[trip.status]}
      </button>

      {/* zona de leitura — abre a viagem */}
      <button className="trip-open" onClick={() => onOpen(trip)}>
        <div className="trip-row1">
          <span className="when">{when}</span>
        </div>
        {(quanto || dias != null) && (
          <div className="trip-datas">
            {quanto && (
              <span className={`conta e-${quanto.estado}`}>{quanto.txt}</span>
            )}
            {dias != null && dias > 0 && (
              <span className="dur">
                {dias} {dias === 1 ? "noite" : "noites"}
              </span>
            )}
          </div>
        )}
        <h3 className="dest">{trip.dest || "Sem nome"}</h3>
        {/* Preview sem a marcação: senão o cartão mostraria "**Dia 1**" com
            os asteriscos à mostra. */}
        {trip.note && <p className="note">{paraTextoSimples(trip.note)}</p>}
      </button>

      {/* zona interativa — marcar item sem abrir nada */}
      {trip.items.length > 0 && (
        <CardChecklist trip={trip} onToggle={onToggleItem} />
      )}

      <div className="trip-foot">
        {trip.budgetCents && trip.budgetCents > 0 ? (
          <span className="budget">
            {formatBRL(trip.budgetCents)} <span className="per">/pessoa</span>
            {/* Segunda linha em vez de tudo emendado: numa só, o texto
                empurrava o "editar →" e o rodapé quebrava torto. */}
            {trip.people > 1 && (
              <span className="total">
                {trip.people} pessoas · {formatBRL(trip.budgetCents * trip.people)}
              </span>
            )}
          </span>
        ) : (
          <span className="budget empty">sem orçamento</span>
        )}
        <button type="button" className="edit-hint" onClick={() => onOpen(trip)}>
          editar →
        </button>
      </div>
    </article>
  );
}

/* ============================================================
   Botão de ação destrutiva, em dois tempos

   O primeiro clique troca o rótulo por "Confirmar?", o segundo executa.
   Escolhi isto em vez do confirm() nativo porque no celular o confirm vira
   um alerta do sistema, descolado da tela — e porque aqui o aviso aparece
   exatamente onde o dedo já está.

   Desarma sozinho depois de alguns segundos: um botão que ficou armado e
   esquecido vira armadilha para o próximo clique distraído.
   ============================================================ */

export const CARD_ITENS_VISIVEIS = 3;

export function CardChecklist({
  trip,
  onToggle,
}: {
  trip: TripDTO;
  onToggle: (i: ChecklistItemDTO) => void;
}) {
  const [aberto, setAberto] = useState(false);

  const items = trip.items;
  const total = items.length;
  const ok = feitos(items);
  const pago = totalPago(items);
  const aPagar = totalAPagar(items);
  const pct = total ? Math.round((ok / total) * 100) : 0;

  const visiveis = aberto ? items : items.slice(0, CARD_ITENS_VISIVEIS);
  const escondidos = total - visiveis.length;

  return (
    <div className="card-check">
      <ul className="card-check-lista">
        {visiveis.map((i) => (
          <li key={i.id} className={i.done ? "feito" : undefined}>
            <button
              type="button"
              className="card-check-box"
              role="checkbox"
              aria-checked={i.done}
              aria-label={i.label}
              title={i.done ? "Desmarcar" : "Marcar como feito"}
              onClick={() => onToggle(i)}
            >
              <span aria-hidden="true">{i.done ? "✓" : ""}</span>
            </button>
            {/* title porque o nome corta com reticências em cartão estreito */}
            <span className="card-check-txt" title={i.label}>
              {i.label}
            </span>
            <span className="card-check-val">
              {i.amountCents != null && i.amountCents > 0
                ? formatBRL(i.amountCents)
                : "—"}
            </span>
          </li>
        ))}
      </ul>

      {total > CARD_ITENS_VISIVEIS && (
        <button
          type="button"
          className="card-check-mais"
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? "ver menos" : `+ mais ${escondidos}`}
        </button>
      )}

      <div className="check-resumo">
        <span
          className="barra"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={ok}
          aria-label={`${ok} de ${total} itens do checklist concluídos`}
        >
          <span className="fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="txt">
          {ok}/{total}
          {pago > 0 && (
            <>
              {" · "}
              <b>{formatBRL(pago)}</b> pagos
            </>
          )}
          {aPagar > 0 && (
            <>
              {" · falta "}
              {formatBRL(aPagar)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   "Já rolou" — as viagens feitas

   Uso <details> nativo em vez de controlar aberto/fechado com estado:
   o navegador já dá o comportamento, o teclado funciona de graça e o
   conteúdo continua encontrável pelo Ctrl+F mesmo recolhido.
   ============================================================ */
