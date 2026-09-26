"use client";

import type { ActivityDTO, TripDTO } from "@/types";
import { formatBRL } from "@/lib/format";
import { linkMapa } from "@/lib/geo";
import { coordenadaValida } from "@/lib/geo";
import { panoramaDaViagem } from "@/lib/em-viagem";
import { telefoneDe } from "@/lib/contato";
import { Capa } from "./Capa";

/* ============================================================
   O painel de quando a viagem está acontecendo

   Substitui o "e a próxima?" enquanto a pessoa está lá. Muda o que
   pergunta: não é mais quanto falta pagar nem o que falta contratar —
   isso já foi. É onde eu durmo, o que é hoje, e quanto já saiu.

   Tudo que é telefone vira link de ligação e todo endereço vira link de
   mapa. É o painel que se usa com uma mão só, em pé, na rua.
   ============================================================ */

export function EmViagem({
  trip,
  hoje,
  onAbrir,
  onLancarGasto,
}: {
  trip: TripDTO;
  hoje: Date;
  onAbrir: () => void;
  onLancarGasto: () => void;
}) {
  const p = panoramaDaViagem(trip, hoje);
  if (!p) return null;

  const temCoord = coordenadaValida(trip.stayLat, trip.stayLng);

  return (
    <section className="agora">
      <Capa
        dest={trip.dest}
        lat={trip.stayLat}
        lng={trip.stayLng}
        className="agora-capa"
        larga
      />

      <div className="agora-conteudo">
        <div className="agora-topo">
          <span className="agora-pulso" aria-hidden="true" />
          <span className="agora-dia">
            Dia {p.dia}
            {p.totalDias ? ` de ${p.totalDias}` : ""}
          </span>
        </div>

        <h2>{trip.dest}</h2>

        {(trip.stayName || trip.stayAddress) && (
          <p className="agora-casa">
            {trip.stayName && <strong>{trip.stayName}</strong>}
            {trip.stayAddress && (
              <span className="agora-end">{trip.stayAddress}</span>
            )}
            {temCoord && (
              /* Link externo de verdade, e não um mapa embutido: quem está
                 na rua quer o app de navegação do celular, com o GPS. */
              <a
                className="agora-link"
                href={linkMapa(
                  trip.stayLat!,
                  trip.stayLng!,
                  trip.stayName || trip.dest,
                )}
                target="_blank"
                rel="noreferrer"
              >
                como chegar →
              </a>
            )}
          </p>
        )}

        <Agenda hoje={p.hoje} aSeguir={p.aSeguir} />

        <div className="agora-pe">
          <span className="agora-gasto">
            {p.gastoCents > 0 ? (
              <>
                <b>{formatBRL(p.gastoCents)}</b> na viagem
                {p.gastoHojeCents > 0 && (
                  <span className="agora-hoje-val">
                    {" · "}
                    {formatBRL(p.gastoHojeCents)} hoje
                  </span>
                )}
              </>
            ) : (
              "nada lançado ainda"
            )}
          </span>

          <span className="agora-botoes">
            {/* Primário porque é a ação do momento: lançar o que acabou de
                sair da carteira, antes de esquecer. */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={onLancarGasto}
            >
              + gasto
            </button>
            <button type="button" className="btn agora-abrir" onClick={onAbrir}>
              Abrir
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}

function Agenda({
  hoje,
  aSeguir,
}: {
  hoje: ActivityDTO[];
  aSeguir: ActivityDTO[];
}) {
  /* Sem nada marcado o bloco some em vez de mostrar "nenhuma atividade":
     um dia livre em viagem não é pendência, e o painel não deve sugerir
     que a pessoa devia ter planejado mais. */
  if (hoje.length === 0 && aSeguir.length === 0) return null;

  return (
    <div className="agora-agenda">
      {hoje.length > 0 ? (
        <>
          <span className="agora-rotulo">Hoje</span>
          <ul>
            {hoje.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </ul>
        </>
      ) : (
        <>
          <span className="agora-rotulo">Hoje sem nada marcado · a seguir</span>
          <ul>
            {aSeguir.slice(0, 2).map((a) => (
              <Item key={a.id} a={a} mostrarData />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Item({
  a,
  mostrarData = false,
}: {
  a: ActivityDTO;
  mostrarData?: boolean;
}) {
  const tel = telefoneDe(a.contact);
  return (
    <li>
      <span className="agora-ativ">
        {a.label}
        {a.timeText && <span className="agora-hora">{a.timeText}</span>}
        {mostrarData && a.whenAt && (
          <span className="agora-hora">{diaCurto(a.whenAt)}</span>
        )}
      </span>
      {a.contact && (
        <span className="agora-contato">
          {tel ? (
            /* O telefone do barqueiro é o dado mais útil desta tela. Em pé
               na praia, ele tem que ser um toque, não um copiar e colar. */
            <a href={`tel:${tel}`}>{a.contact}</a>
          ) : (
            a.contact
          )}
        </span>
      )}
    </li>
  );
}

const curto = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function diaCurto(iso: string): string {
  return curto.format(new Date(`${iso}T00:00:00.000Z`)).replace(/\./g, "");
}
