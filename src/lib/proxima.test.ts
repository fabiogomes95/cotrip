import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proximaViagem } from "./proxima";
import type { TripDTO } from "@/types";

const HOJE = new Date("2026-09-25T12:00:00-03:00");

function v(p: Partial<TripDTO>): TripDTO {
  return {
    id: Math.random().toString(36).slice(2),
    boardId: "q1",
    dest: "Destino",
    whenText: "",
    year: 0,
    startDate: null,
    endDate: null,
    status: "IDEIA",
    budgetCents: null,
    people: 1,
    note: "",
    stayName: "",
    stayAddress: "",
    stayLat: null,
    stayLng: null,
    createdAt: "",
    updatedAt: "",
    items: [],
    preTasks: [],
    activities: [],
    expenses: [],
    ...p,
  };
}

describe("proximaViagem", () => {
  it("a mais próxima com data vence", () => {
    const r = proximaViagem(
      [
        v({ dest: "Longe", startDate: "2027-01-10" }),
        v({ dest: "Perto", startDate: "2026-11-12" }),
      ],
      HOJE,
    );
    assert.equal(r?.dest, "Perto");
  });

  it("a que está acontecendo agora ganha de tudo", () => {
    // no meio da viagem, nada interessa mais que ela
    const r = proximaViagem(
      [
        v({ dest: "Amanhã", startDate: "2026-09-26" }),
        v({ dest: "Agora", startDate: "2026-09-23", endDate: "2026-09-30" }),
      ],
      HOJE,
    );
    assert.equal(r?.dest, "Agora");
  });

  it("o último dia ainda conta como em andamento", () => {
    const r = proximaViagem(
      [v({ dest: "Terminando", startDate: "2026-09-20", endDate: "2026-09-25" })],
      HOJE,
    );
    assert.equal(r?.dest, "Terminando");
  });

  it("ignora o que já passou", () => {
    const r = proximaViagem(
      [
        v({ dest: "Passada", startDate: "2026-08-01", endDate: "2026-08-10" }),
        v({ dest: "Futura", startDate: "2027-03-01" }),
      ],
      HOJE,
    );
    assert.equal(r?.dest, "Futura");
  });

  it("viagem feita nunca vai para o destaque", () => {
    // ela já tem o bloco "Já rolou"
    const r = proximaViagem(
      [v({ dest: "Feita", status: "FEITA", startDate: "2026-11-12" })],
      HOJE,
    );
    assert.equal(r, null);
  });

  it("sem datas, cai para o ano mais próximo", () => {
    const r = proximaViagem(
      [v({ dest: "2028", year: 2028 }), v({ dest: "2026", year: 2026 })],
      HOJE,
    );
    assert.equal(r?.dest, "2026");
  });

  it("no mesmo ano, compromisso ganha de vontade", () => {
    const r = proximaViagem(
      [
        v({ dest: "Só ideia", year: 2027, status: "IDEIA" }),
        v({ dest: "Reservada", year: 2027, status: "RESERVADO" }),
        v({ dest: "Planejando", year: 2027, status: "PLANEJANDO" }),
      ],
      HOJE,
    );
    assert.equal(r?.dest, "Reservada");
  });

  it("data marcada ganha de ano solto, mesmo sendo mais tarde", () => {
    // ter data é sinal de que a coisa está de pé
    const r = proximaViagem(
      [
        v({ dest: "Só o ano", year: 2026, status: "RESERVADO" }),
        v({ dest: "Com data", startDate: "2027-06-01", status: "IDEIA" }),
      ],
      HOJE,
    );
    assert.equal(r?.dest, "Com data");
  });

  it("'algum dia' não vira destaque", () => {
    // ano 0 é o sonho sem data; não é a próxima viagem de ninguém
    assert.equal(proximaViagem([v({ dest: "Japão", year: 0 })], HOJE), null);
  });

  it("ano no passado não vira destaque", () => {
    assert.equal(proximaViagem([v({ dest: "Velha", year: 2020 })], HOJE), null);
  });

  it("quadro vazio devolve nulo", () => {
    assert.equal(proximaViagem([], HOJE), null);
  });
});
