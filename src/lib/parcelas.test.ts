import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faltaCents,
  pagoCents,
  parcelasRestantes,
  proximoVencimento,
  quitado,
  valorParcela,
} from "./parcelas";
import type { ItemComVencimento } from "./parcelas";

function item(p: Partial<ItemComVencimento> = {}): ItemComVencimento {
  return {
    amountCents: null,
    installments: 1,
    paidInstallments: 0,
    firstDueDate: null,
    ...p,
  };
}

describe("valorParcela", () => {
  it("divide o total pelo número de vezes", () => {
    assert.equal(valorParcela(item({ amountCents: 228000, installments: 6 })), 38000);
  });

  it("à vista, a parcela é o total", () => {
    assert.equal(valorParcela(item({ amountCents: 50000 })), 50000);
  });

  it("item sem valor não tem parcela", () => {
    assert.equal(valorParcela(item({ installments: 3 })), 0);
  });
});

describe("pagoCents", () => {
  it("nada pago é zero", () => {
    assert.equal(pagoCents(item({ amountCents: 228000, installments: 6 })), 0);
  });

  it("conta proporcional ao que já venceu", () => {
    const i = item({ amountCents: 228000, installments: 6, paidInstallments: 3 });
    assert.equal(pagoCents(i), 114000);
  });

  it("tudo pago devolve exatamente o total, sem sobra de arredondamento", () => {
    // 100 em 3x daria 33+33+33 = 99 se somasse parcela a parcela; o centavo
    // que falta não pode ficar pendurado para sempre
    const i = item({ amountCents: 100, installments: 3, paidInstallments: 3 });
    assert.equal(pagoCents(i), 100);
    assert.equal(faltaCents(i), 0);
    assert.equal(quitado(i), true);
  });

  it("não deixa pagar mais parcelas do que existem", () => {
    const i = item({ amountCents: 50000, installments: 2, paidInstallments: 9 });
    assert.equal(pagoCents(i), 50000);
  });

  it("valores negativos ou zerados não viram dívida", () => {
    assert.equal(pagoCents(item({ amountCents: 0, paidInstallments: 1 })), 0);
    assert.equal(pagoCents(item({ amountCents: 1000, paidInstallments: -3 })), 0);
  });
});

describe("faltaCents", () => {
  it("o que resta depois do que já foi pago", () => {
    const i = item({ amountCents: 228000, installments: 6, paidInstallments: 2 });
    assert.equal(faltaCents(i), 152000);
    assert.equal(pagoCents(i) + faltaCents(i), 228000);
  });

  it("pago mais falta sempre fecha o total, mesmo com divisão inexata", () => {
    for (const pagas of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const i = item({ amountCents: 100033, installments: 7, paidInstallments: pagas });
      assert.equal(pagoCents(i) + faltaCents(i), 100033, `falhou com ${pagas} pagas`);
    }
  });
});

describe("proximoVencimento", () => {
  it("sem nenhuma paga, vence a primeira", () => {
    const i = item({ amountCents: 100, installments: 6, firstDueDate: "2026-10-10" });
    assert.equal(proximoVencimento(i), "2026-10-10");
  });

  it("anda um mês por parcela paga", () => {
    const i = item({
      amountCents: 100, installments: 6, paidInstallments: 3, firstDueDate: "2026-10-10",
    });
    assert.equal(proximoVencimento(i), "2027-01-10");
  });

  it("quitado não tem próximo vencimento", () => {
    const i = item({
      amountCents: 100, installments: 3, paidInstallments: 3, firstDueDate: "2026-10-10",
    });
    assert.equal(proximoVencimento(i), null);
  });

  it("sem data da primeira parcela não há o que calcular", () => {
    assert.equal(proximoVencimento(item({ amountCents: 100, installments: 6 })), null);
  });
});

describe("parcelasRestantes", () => {
  it("conta o que ainda vai vencer", () => {
    assert.equal(parcelasRestantes(item({ installments: 6, paidInstallments: 2 })), 4);
    assert.equal(parcelasRestantes(item({ installments: 6, paidInstallments: 6 })), 0);
  });
});
