import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estaEmViagem, panoramaDaViagem } from "./em-viagem";
import type { ActivityDTO, TripDTO } from "@/types";

/* As datas são fixas de propósito: um teste de "hoje" que usa o relógio
   real passa hoje e quebra amanhã. `agora` é sempre injetado. */
const EM = (d: string) => new Date(`${d}T12:00:00.000Z`);

function atividade(p: Partial<ActivityDTO>): ActivityDTO {
  return {
    id: Math.random().toString(36).slice(2),
    tripId: "t1",
    label: "passeio",
    contact: "",
    whenAt: null,
    timeText: "",
    status: "IDEIA",
    note: "",
    position: 0,
    ...p,
  };
}

function viagem(p: Partial<TripDTO> = {}): TripDTO {
  return {
    id: "t1",
    boardId: "b1",
    dest: "Fernando de Noronha",
    whenText: "",
    year: 2026,
    startDate: "2026-11-12",
    endDate: "2026-11-19",
    status: "RESERVADO",
    budgetCents: null,
    people: 2,
    note: "",
    stayName: "",
    stayAddress: "",
    stayLat: null,
    stayLng: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [],
    preTasks: [],
    activities: [],
    expenses: [],
    ...p,
  } as TripDTO;
}

describe("estaEmViagem", () => {
  it("não antes da ida", () => {
    assert.equal(estaEmViagem(viagem(), EM("2026-11-11")), false);
  });

  it("sim no dia da ida", () => {
    assert.equal(estaEmViagem(viagem(), EM("2026-11-12")), true);
  });

  it("sim no meio", () => {
    assert.equal(estaEmViagem(viagem(), EM("2026-11-15")), true);
  });

  it("sim no dia da volta — quem está voltando ainda está viajando", () => {
    assert.equal(estaEmViagem(viagem(), EM("2026-11-19")), true);
  });

  it("não no dia seguinte à volta", () => {
    assert.equal(estaEmViagem(viagem(), EM("2026-11-20")), false);
  });

  it("sem volta, vale só o dia da ida", () => {
    // Sem saber quando acaba, supor que continua deixaria o painel travado
    // em modo viagem para sempre.
    const v = viagem({ endDate: null });
    assert.equal(estaEmViagem(v, EM("2026-11-12")), true);
    assert.equal(estaEmViagem(v, EM("2026-11-13")), false);
  });

  it("viagem sem data nunca está em curso", () => {
    assert.equal(
      estaEmViagem(viagem({ startDate: null, endDate: null }), EM("2026-11-15")),
      false,
    );
  });

  it("viagem marcada como feita não está em curso, mesmo dentro das datas", () => {
    assert.equal(estaEmViagem(viagem({ status: "FEITA" }), EM("2026-11-15")), false);
  });
});

describe("panoramaDaViagem", () => {
  it("conta o dia a partir de 1 na chegada", () => {
    assert.equal(panoramaDaViagem(viagem(), EM("2026-11-12"))!.dia, 1);
    assert.equal(panoramaDaViagem(viagem(), EM("2026-11-14"))!.dia, 3);
    assert.equal(panoramaDaViagem(viagem(), EM("2026-11-19"))!.dia, 8);
  });

  it("o total é noites + 1: 12 a 19 são 8 dias", () => {
    assert.equal(panoramaDaViagem(viagem(), EM("2026-11-14"))!.totalDias, 8);
  });

  it("o total não muda conforme os dias passam", () => {
    // Regressão: calcular o total a partir de "hoje" em vez das duas pontas
    // fazia a viagem encolher durante ela mesma.
    const t1 = panoramaDaViagem(viagem(), EM("2026-11-12"))!.totalDias;
    const t2 = panoramaDaViagem(viagem(), EM("2026-11-18"))!.totalDias;
    assert.equal(t1, t2);
  });

  it("sem volta, total é null e não zero", () => {
    const p = panoramaDaViagem(viagem({ endDate: null }), EM("2026-11-12"))!;
    assert.equal(p.totalDias, null);
  });

  it("separa as atividades de hoje das seguintes", () => {
    const v = viagem({
      activities: [
        atividade({ label: "mergulho", whenAt: "2026-11-14", position: 1 }),
        atividade({ label: "café", whenAt: "2026-11-14", position: 0 }),
        atividade({ label: "trilha", whenAt: "2026-11-16" }),
        atividade({ label: "ontem", whenAt: "2026-11-13" }),
        atividade({ label: "quem sabe", whenAt: null }),
      ],
    });
    const p = panoramaDaViagem(v, EM("2026-11-14"))!;
    // Dentro do dia vale a ordem arrastada, não o texto do horário.
    assert.deepEqual(p.hoje.map((a) => a.label), ["café", "mergulho"]);
    assert.deepEqual(p.aSeguir.map((a) => a.label), ["trilha"]);
    assert.deepEqual(p.semData.map((a) => a.label), ["quem sabe"]);
  });

  it("atividade já feita sai da lista", () => {
    const v = viagem({
      activities: [
        atividade({ label: "feita", whenAt: "2026-11-14", status: "FEITO" }),
        atividade({ label: "aberta", whenAt: "2026-11-14" }),
      ],
    });
    const p = panoramaDaViagem(v, EM("2026-11-14"))!;
    assert.deepEqual(p.hoje.map((a) => a.label), ["aberta"]);
  });

  it("soma o total gasto e o de hoje separadamente", () => {
    const v = viagem({
      expenses: [
        { id: "1", tripId: "t1", label: "táxi", category: "TRANSPORTE", totalCents: 9000, spentOn: "2026-11-12", paidById: null, note: "" },
        { id: "2", tripId: "t1", label: "almoço", category: "ALIMENTACAO", totalCents: 18000, spentOn: "2026-11-14", paidById: null, note: "" },
        { id: "3", tripId: "t1", label: "sorvete", category: "OUTROS", totalCents: 2500, spentOn: "2026-11-14", paidById: null, note: "" },
        { id: "4", tripId: "t1", label: "sem data", category: "OUTROS", totalCents: 1000, spentOn: null, paidById: null, note: "" },
      ],
    });
    const p = panoramaDaViagem(v, EM("2026-11-14"))!;
    assert.equal(p.gastoCents, 30500);
    assert.equal(p.gastoHojeCents, 20500);
  });

  it("null quando a viagem não está acontecendo", () => {
    assert.equal(panoramaDaViagem(viagem(), EM("2026-10-01")), null);
  });
});
