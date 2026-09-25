"use client";

import type { TripDTO } from "@/types";
import { STATUS_LABEL } from "@/lib/status";
import { formatBRL } from "@/lib/format";
import { contagem, formatarPeriodo, noites } from "@/lib/datas";
import { feitos, totalAPagar } from "@/lib/checklist";
import { progresso } from "@/lib/pre-viagem";
import { Capa } from "./Capa";

/**
 * O painel de destaque no topo do quadro.
 *
 * Responde de cara a pergunta que a pessoa abre o app para fazer: "e a
 * próxima?". Por isso mostra o que ainda depende dela — quanto falta pagar,
 * o que falta contratar, o que falta fazer antes de sair — e não o que já
 * está resolvido.
 */
export function ProximaViagem({
  trip,
  hoje,
  onAbrir,
}: {
  trip: TripDTO;
  hoje: Date | null;
  onAbrir: () => void;
}) {
  const quanto = hoje ? contagem(trip.startDate, trip.endDate, hoje) : null;
  const periodo = formatarPeriodo(trip.startDate, trip.endDate);
  const dias = noites(trip.startDate, trip.endDate);

  const aPagar = totalAPagar(trip.items);
  const itensAbertos = trip.items.length - feitos(trip.items);
  const antes = progresso(trip.preTasks);

  const pendencias: string[] = [];
  if (aPagar > 0) pendencias.push(`${formatBRL(aPagar)} a pagar`);
  if (itensAbertos > 0) {
    pendencias.push(`${itensAbertos} ${itensAbertos === 1 ? "item" : "itens"} a fechar`);
  }
  if (antes.total > 0 && !antes.tudoPronto) {
    pendencias.push(`antes de sair ${antes.feitas}/${antes.total}`);
  }

  return (
    <section className={`proxima s-${trip.status}`}>
      <Capa dest={trip.dest} lat={trip.stayLat} lng={trip.stayLng} className="proxima-capa" larga />

      <div className="proxima-conteudo">
        <div className="proxima-topo">
          {/* A contagem só existe depois que o componente monta: no servidor
              "hoje" é UTC e à noite daria um dia de diferença. */}
          <span className="chamada">{quanto?.txt ?? "próxima viagem"}</span>
          <span className={`selo s-${trip.status}`}>{STATUS_LABEL[trip.status]}</span>
        </div>

        <h2>{trip.dest}</h2>

        <p className="quando">
          {periodo ??
            [trip.whenText, trip.year > 0 ? trip.year : null].filter(Boolean).join(" · ") ??
            ""}
          {dias != null && dias > 0 && ` · ${dias} ${dias === 1 ? "noite" : "noites"}`}
        </p>

        <div className="proxima-pe">
          {pendencias.length > 0 ? (
            <span className="pendencias">{pendencias.join(" · ")}</span>
          ) : (
            <span className="pendencias tudo-certo">tudo resolvido ✦</span>
          )}
          <button type="button" className="btn" onClick={onAbrir}>
            Abrir
          </button>
        </div>
      </div>
    </section>
  );
}
