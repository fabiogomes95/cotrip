import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mediaPorDia, porCategoria, porPessoa, totalGasto } from "./gastos";
import type { ExpenseDTO } from "@/types";

function g(totalCents: number, category: ExpenseDTO["category"] = "OUTROS"): ExpenseDTO {
  return {
    id: Math.random().toString(36).slice(2),
    tripId: "v1",
    label: "gasto",
    category,
    totalCents,
    spentOn: null,
    paidById: null,
    note: "",
  };
}

describe("totalGasto", () => {
  it("soma tudo", () => {
    assert.equal(totalGasto([g(2200), g(3100), g(1500)]), 6800);
  });
  it("lista vazia é zero", () => {
    assert.equal(totalGasto([]), 0);
  });
});

describe("porCategoria", () => {
  it("ordena pelo maior gasto, não pela ordem das categorias", () => {
    // é isso que responde "onde meu dinheiro está indo"
    const r = porCategoria([
      g(1000, "ALIMENTACAO"),
      g(8000, "TRANSPORTE"),
      g(3000, "PASSEIO"),
    ]);
    assert.deepEqual(r.map((x) => x.categoria), ["TRANSPORTE", "PASSEIO", "ALIMENTACAO"]);
  });

  it("junta vários gastos da mesma categoria", () => {
    // o caso do Uber: muitos pequenos que só assustam somados
    const r = porCategoria([
      g(2200, "TRANSPORTE"),
      g(3100, "TRANSPORTE"),
      g(2700, "TRANSPORTE"),
    ]);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.total, 8000);
    assert.equal(r[0]!.pct, 100);
  });

  it("calcula a fatia de cada categoria", () => {
    const r = porCategoria([g(7500, "TRANSPORTE"), g(2500, "COMPRAS")]);
    assert.equal(r[0]!.pct, 75);
    assert.equal(r[1]!.pct, 25);
  });

  it("categoria sem gasto não aparece", () => {
    const r = porCategoria([g(100, "COMPRAS")]);
    assert.deepEqual(r.map((x) => x.categoria), ["COMPRAS"]);
  });

  it("lista vazia não quebra nem divide por zero", () => {
    assert.deepEqual(porCategoria([]), []);
  });
});

describe("porPessoa", () => {
  it("divide o total pelo número de viajantes", () => {
    // gasto avulso é valor CHEIO; dividir é o que permite comparar com o
    // orçamento, que é por pessoa
    assert.equal(porPessoa([g(10000)], 2), 5000);
  });
  it("zero pessoas não divide por zero", () => {
    assert.equal(porPessoa([g(10000)], 0), 10000);
  });
});

describe("mediaPorDia", () => {
  it("divide pelo número de dias", () => {
    assert.equal(mediaPorDia([g(70000)], 7), 10000);
  });
  it("sem duração não há média", () => {
    assert.equal(mediaPorDia([g(70000)], null), null);
    assert.equal(mediaPorDia([g(70000)], 0), null);
  });
});
