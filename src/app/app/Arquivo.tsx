"use client";

import { Capa } from "./Capa";

import type { TripDTO } from "@/types";
import { formatBRL, yearLabel } from "@/lib/format";
import { formatarPeriodo, noites } from "@/lib/datas";
import { custoDaViagem } from "@/lib/checklist";
import { resumoDaNota } from "@/lib/markdown";

/* ============================================================
   Diário de bordo — a linha vista para trás

   A mesma linha do fluxo, continuada. Em cima ela sobe para o que ainda vai
   acontecer; aqui desce para o que já aconteceu, do mais recente ao mais
   antigo — é a ordem em que a memória procura.

   O cartão é outro de propósito. Numa viagem que ainda vem, o que importa é
   o que falta resolver: quanto pagar, o que contratar. Numa que já foi, não
   falta nada — o que sobrou dela é o texto que a pessoa escreveu. Por isso
   aqui o diário ocupa o lugar que lá era do checklist, e o dinheiro desce
   para uma linha só, no rodapé.
   ============================================================ */

/** O custo de uma viagem feita: checklist por pessoa + gastos avulsos. */
function custo(t: TripDTO): number {
  return custoDaViagem(t.items, t.expenses, t.people);
}

export function Arquivo({
  trips,
  aberto,
  onOpen,
}: {
  trips: TripDTO[];
  aberto: boolean;
  onOpen: (t: TripDTO) => void;
}) {
  const total = trips.reduce((s, t) => s + custo(t), 0);

  /* Agrupa por ano para a linha ter marcos também aqui. Descendo no tempo:
     o ano mais recente primeiro. */
  const anos = [...new Set(trips.map((t) => t.year || 0))].sort(
    (a, b) => (b || 0) - (a || 0),
  );

  return (
    <details className="historias" open={aberto}>
      <summary>
        <span className="seta" aria-hidden="true">
          ▸
        </span>
        <span className="tit">Diário de bordo</span>
        <span className="meta">
          {trips.length} {trips.length === 1 ? "viagem" : "viagens"}
          {total > 0 && (
            <>
              {" · "}
              <b>{formatBRL(total)}</b> gastos
            </>
          )}
        </span>
      </summary>

      {/* Mesmo contêiner .fluxo do quadro: é literalmente a mesma linha, com
          a variação de cor invertida — forte no passado recente, apagando
          conforme vai longe. */}
      <div className="fluxo fluxo-passado">
        {anos.map((ano) => (
          <Ano
            key={ano}
            ano={ano}
            trips={trips.filter((t) => (t.year || 0) === ano)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </details>
  );
}

function Ano({
  ano,
  trips,
  onOpen,
}: {
  ano: number;
  trips: TripDTO[];
  onOpen: (t: TripDTO) => void;
}) {
  const gasto = trips.reduce((s, t) => s + custo(t), 0);
  return (
    <>
      <div className="fluxo-ano">
        <span className="fluxo-no" aria-hidden="true" />
        <div className="fluxo-corpo">
          <div className="year-head">
            <h2>{yearLabel(ano)}</h2>
            <span className="meta">
              {trips.length} {trips.length === 1 ? "viagem" : "viagens"}
              {gasto > 0 && (
                <>
                  {" · "}
                  <b>{formatBRL(gasto)}</b>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {trips.map((t) => (
        <div className="fluxo-item" key={t.id}>
          <span className="fluxo-no s-FEITA" aria-hidden="true" />
          <div className="fluxo-corpo">
            <Memoria trip={t} onOpen={onOpen} />
          </div>
        </div>
      ))}
    </>
  );
}

function Memoria({
  trip,
  onOpen,
}: {
  trip: TripDTO;
  onOpen: (t: TripDTO) => void;
}) {
  const periodo = formatarPeriodo(trip.startDate, trip.endDate);
  const dias = noites(trip.startDate, trip.endDate);
  const gasto = custo(trip);

  const detalhes = [
    periodo ?? trip.whenText ?? null,
    dias != null && dias > 0
      ? `${dias} ${dias === 1 ? "noite" : "noites"}`
      : null,
    trip.people > 1 ? `${trip.people} pessoas` : null,
  ].filter(Boolean);

  const historia = trip.note ? resumoDaNota(trip.note, 10) : "";

  return (
    <article className="mem">
      <div className="mem-capa">
        <Capa dest={trip.dest} lat={trip.stayLat} lng={trip.stayLng} />
      </div>

      <div className="mem-corpo">
        <button
          type="button"
          className="mem-abrir"
          onClick={() => onOpen(trip)}
        >
          <h3>{trip.dest || "Sem nome"}</h3>
          {detalhes.length > 0 && (
            <p className="mem-quando">{detalhes.join(" · ")}</p>
          )}

          {historia ? (
            <p className="mem-texto">{historia}</p>
          ) : (
            /* Sem texto o cartão ficaria oco, e o convite certo não é "abra
               a viagem" — é "escreva o que aconteceu". */
            <p className="mem-texto vazio">
              Nada escrito ainda sobre esta viagem.
            </p>
          )}
        </button>

        <div className="mem-pe">
          <span className="mem-gasto">
            {gasto > 0 ? (
              <>
                <b>{formatBRL(gasto)}</b> gastos
              </>
            ) : (
              <span className="vazio">sem valores lançados</span>
            )}
          </span>
          <button
            type="button"
            className="mem-link"
            onClick={() => onOpen(trip)}
          >
            {historia ? "ler o diário →" : "escrever →"}
          </button>
        </div>
      </div>
    </article>
  );
}
