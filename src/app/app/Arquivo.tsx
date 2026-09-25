"use client";

import type { TripDTO } from "@/types";
import { formatBRL, yearLabel } from "@/lib/format";
import { totalPago } from "@/lib/checklist";


export function Arquivo({
  trips,
  aberto,
  onOpen,
}: {
  trips: TripDTO[];
  aberto: boolean;
  onOpen: (t: TripDTO) => void;
}) {
  const total = trips.reduce((s, t) => s + totalPago(t.items), 0);

  return (
    <details className="arquivo" open={aberto}>
      <summary>
        <span className="seta" aria-hidden="true">
          ▸
        </span>
        <span className="tit">Já rolou</span>
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

      <ul className="arquivo-lista">
        {trips.map((t) => {
          const g = totalPago(t.items);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onOpen(t)}>
                <span className="ano">{yearLabel(t.year)}</span>
                <span className="dest">{t.dest || "Sem nome"}</span>
                <span className="val">
                  {g > 0
                    ? formatBRL(g)
                    : t.budgetCents
                      ? formatBRL(t.budgetCents)
                      : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/* ============================================================
   Acerto de contas

   Aparece só em quadro compartilhado e só depois que alguém pagou alguma
   coisa. Mostra o que cada um desembolsou, o que caberia a cada um, e
   sugere as transferências que zeram tudo.
   ============================================================ */
