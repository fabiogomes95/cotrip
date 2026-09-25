"use client";

import type { ChecklistItemDTO, ExpenseDTO, MemberDTO } from "@/types";
import { calcularSaldos, sugerirPagamentos } from "@/lib/acerto";
import { formatBRL } from "@/lib/format";


export function Acerto({
  items,
  gastos,
  membros,
  people,
}: {
  items: ChecklistItemDTO[];
  gastos: ExpenseDTO[];
  membros: MemberDTO[];
  people: number;
}) {
  const saldos = calcularSaldos(items, gastos, membros, people);
  const transferencias = sugerirPagamentos(saldos);

  return (
    <div className="acerto">
      <div className="acerto-tit">Acerto de contas</div>

      <ul className="acerto-lista">
        {saldos.map((s) => (
          <li key={s.userId}>
            <span className="nome">{s.name}</span>
            <span className="valores">
              pagou {formatBRL(s.desembolsou)} · parte {formatBRL(s.parte)}
            </span>
            <span
              className={`saldo${s.saldo > 0 ? " recebe" : s.saldo < 0 ? " deve" : ""}`}
            >
              {s.saldo === 0
                ? "quite"
                : s.saldo > 0
                  ? `+${formatBRL(s.saldo)}`
                  : `−${formatBRL(-s.saldo)}`}
            </span>
          </li>
        ))}
      </ul>

      {transferencias.length > 0 ? (
        <ul className="acerto-transf">
          {transferencias.map((t, i) => (
            <li key={i}>
              <b>{t.de}</b> paga {formatBRL(t.valor)} para <b>{t.para}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="acerto-ok">Ninguém deve nada a ninguém ✦</p>
      )}
    </div>
  );
}

/* ============================================================
   Diário (campo de anotações em Markdown)

   Duas abas em vez de um editor rico: o conteúdo continua sendo texto puro,
   que a pessoa lê mesmo sem o app e que o banco guarda sem saber que é
   Markdown. Um WYSIWYG traria mais de 100KB de JavaScript para resolver algo
   que quatro botões e uma pré-visualização resolvem.
   ============================================================ */
