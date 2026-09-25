import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faltaCents,
  valorEntrada,
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
    downPaymentCents: null,
    downPaymentPaid: false,
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
    assert.equal(
      parcelasRestantes(item({ amountCents: 60000, installments: 6, paidInstallments: 2 })),
      4,
    );
    assert.equal(
      parcelasRestantes(item({ amountCents: 60000, installments: 6, paidInstallments: 6 })),
      0,
    );
  });

  it("item sem valor não tem parcela pendente", () => {
    assert.equal(parcelasRestantes(item({ installments: 6, paidInstallments: 2 })), 0);
  });

  it("pago inteiro na entrada não sobra parcela", () => {
    const i = item({ amountCents: 50000, downPaymentCents: 50000, installments: 6 });
    assert.equal(parcelasRestantes(i), 0);
    assert.equal(valorParcela(i), 0);
  });
});

describe("entrada", () => {
  it("só o restante é parcelado", () => {
    // R$ 2.180 com R$ 500 de entrada: sobram R$ 1.680 em 6x de R$ 280
    const i = item({ amountCents: 218000, downPaymentCents: 50000, installments: 6 });
    assert.equal(valorEntrada(i), 50000);
    assert.equal(valorParcela(i), 28000);
  });

  it("entrada não paga não conta como dinheiro que saiu", () => {
    const i = item({
      amountCents: 218000, downPaymentCents: 50000, downPaymentPaid: false, installments: 6,
    });
    assert.equal(pagoCents(i), 0);
    assert.equal(faltaCents(i), 218000);
  });

  it("entrada paga entra no total pago", () => {
    const i = item({
      amountCents: 218000, downPaymentCents: 50000, downPaymentPaid: true, installments: 6,
    });
    assert.equal(pagoCents(i), 50000);
    assert.equal(faltaCents(i), 168000);
  });

  it("entrada paga mais parcelas pagas somam certo", () => {
    const i = item({
      amountCents: 218000, downPaymentCents: 50000, downPaymentPaid: true,
      installments: 6, paidInstallments: 2,
    });
    // 500 de entrada + 2 × 280
    assert.equal(pagoCents(i), 50000 + 56000);
    assert.equal(faltaCents(i), 218000 - 106000);
  });

  it("tudo pago fecha exatamente o total, mesmo com divisão inexata", () => {
    const i = item({
      amountCents: 100033, downPaymentCents: 33, downPaymentPaid: true,
      installments: 7, paidInstallments: 7,
    });
    assert.equal(pagoCents(i), 100033);
    assert.equal(faltaCents(i), 0);
    assert.equal(quitado(i), true);
  });

  it("parcelas todas pagas com entrada em aberto NÃO é quitado", () => {
    // o caso traiçoeiro: contar só as parcelas diria "quitado" com a entrada
    // ainda devendo
    const i = item({
      amountCents: 218000, downPaymentCents: 50000, downPaymentPaid: false,
      installments: 6, paidInstallments: 6,
    });
    assert.equal(quitado(i), false);
    assert.equal(faltaCents(i), 50000);
  });

  it("entrada maior que o total é limitada ao total", () => {
    const i = item({
      amountCents: 50000, downPaymentCents: 90000, downPaymentPaid: true, installments: 3,
    });
    assert.equal(valorEntrada(i), 50000);
    assert.equal(pagoCents(i), 50000);
    assert.equal(faltaCents(i), 0);
  });

  it("pago mais falta sempre fecha o total, com entrada no meio", () => {
    for (const pagas of [0, 1, 2, 3, 4, 5]) {
      for (const paga of [true, false]) {
        const i = item({
          amountCents: 99991, downPaymentCents: 1234, downPaymentPaid: paga,
          installments: 5, paidInstallments: pagas,
        });
        assert.equal(
          pagoCents(i) + faltaCents(i), 99991,
          `falhou com ${pagas} parcelas e entrada ${paga ? "paga" : "em aberto"}`,
        );
      }
    }
  });
});
