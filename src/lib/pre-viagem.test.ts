import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agruparPorMomento, pendenciasPorPessoa, progresso } from "./pre-viagem";
import type { PreTaskDTO } from "@/types";

function t(p: Partial<PreTaskDTO>): PreTaskDTO {
  return {
    id: Math.random().toString(36).slice(2),
    tripId: "v1",
    label: "Tarefa",
    done: false,
    assignee: "",
    when: "ANTES",
    position: 0,
    ...p,
  };
}

describe("agruparPorMomento", () => {
  it("agrupa na ordem cronológica, não na de criação", () => {
    // a pessoa pode cadastrar "fechar o gás" antes de "avisar no trabalho";
    // a lista tem que sair na ordem em que as coisas acontecem
    const g = agruparPorMomento([
      t({ label: "Fechar o gás", when: "SAIDA" }),
      t({ label: "Avisar no trabalho", when: "ANTES" }),
      t({ label: "Tirar o lixo", when: "VESPERA" }),
    ]);
    assert.deepEqual(g.map((x) => x.momento), ["ANTES", "VESPERA", "SAIDA"]);
  });

  it("pula grupo vazio", () => {
    const g = agruparPorMomento([t({ when: "SAIDA" })]);
    assert.deepEqual(g.map((x) => x.momento), ["SAIDA"]);
  });

  it("dentro do grupo, respeita a posição", () => {
    const g = agruparPorMomento([
      t({ label: "segunda", position: 2 }),
      t({ label: "primeira", position: 1 }),
    ]);
    assert.deepEqual(g[0]!.tarefas.map((x) => x.label), ["primeira", "segunda"]);
  });

  it("lista vazia não quebra", () => {
    assert.deepEqual(agruparPorMomento([]), []);
  });
});

describe("progresso", () => {
  it("conta o que já foi feito", () => {
    const r = progresso([t({ done: true }), t({ done: true }), t({ done: false })]);
    assert.equal(r.feitas, 2);
    assert.equal(r.total, 3);
    assert.equal(r.pct, 67);
  });

  it("tudo marcado é tudo pronto", () => {
    assert.equal(progresso([t({ done: true })]).tudoPronto, true);
  });

  it("lista vazia NÃO é tudo pronto", () => {
    // sem esta distinção o app daria um joinha para quem não preparou nada
    const r = progresso([]);
    assert.equal(r.tudoPronto, false);
    assert.equal(r.pct, 0);
  });
});

describe("pendenciasPorPessoa", () => {
  it("junta o que cada pessoa ficou de fazer", () => {
    const r = pendenciasPorPessoa([
      t({ label: "Alimentar os gatos", assignee: "Duda" }),
      t({ label: "Passear com o Duque", assignee: "Duda" }),
      t({ label: "Regar as plantas", assignee: "Dona Marta" }),
    ]);
    assert.deepEqual(r, [
      { pessoa: "Dona Marta", tarefas: ["Regar as plantas"] },
      { pessoa: "Duda", tarefas: ["Alimentar os gatos", "Passear com o Duque"] },
    ]);
  });

  it("ignora tarefa sem responsável", () => {
    assert.deepEqual(pendenciasPorPessoa([t({ label: "x", assignee: "  " })]), []);
  });

  it("ignora o que já foi feito: não se cobra o que está pronto", () => {
    const r = pendenciasPorPessoa([
      t({ label: "feita", assignee: "Duda", done: true }),
      t({ label: "pendente", assignee: "Duda" }),
    ]);
    assert.deepEqual(r, [{ pessoa: "Duda", tarefas: ["pendente"] }]);
  });

  it("some da lista quando a pessoa termina tudo", () => {
    const r = pendenciasPorPessoa([t({ assignee: "Duda", done: true })]);
    assert.deepEqual(r, []);
  });

  it("ordena por nome, com acento no lugar certo", () => {
    const r = pendenciasPorPessoa([
      t({ assignee: "Zeca" }),
      t({ assignee: "Ácaro" }),
      t({ assignee: "Bia" }),
    ]);
    assert.deepEqual(r.map((x) => x.pessoa), ["Ácaro", "Bia", "Zeca"]);
  });
});
