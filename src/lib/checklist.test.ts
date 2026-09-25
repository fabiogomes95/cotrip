import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compararComOrcamento,
  feitos,
  totalAPagar,
  totalContratado,
  totalPago,
} from "./checklist";
import type { ChecklistItemDTO } from "@/types";

function item(p: Partial<ChecklistItemDTO>): ChecklistItemDTO {
  return {
    id: "x",
    tripId: "t",
    label: "Item",
    done: false,
    amountCents: null,
    installments: 1,
    paidInstallments: 0,
    firstDueDate: null,
    position: 0,
    ...p,
  };
}

describe("totalContratado", () => {
  it("soma apenas o que já foi marcado como contratado", () => {
    // o item não marcado tem preço, mas ainda não é um compromisso
    const r = totalContratado([
      item({ done: true, amountCents: 218000 }),
      item({ done: true, amountCents: 165000 }),
      item({ done: false, amountCents: 38000 }),
    ]);
    assert.equal(r, 383000);
  });

  it("ignora item feito sem valor lançado", () => {
    const r = totalContratado([
      item({ done: true, amountCents: 50000 }),
      item({ done: true, amountCents: null }),
    ]);
    assert.equal(r, 50000);
  });

  it("checklist vazio custa zero, não quebra", () => {
    assert.equal(totalContratado([]), 0);
  });

  it("soma em centavos não acumula erro de fração", () => {
    // o motivo de guardar centavos como inteiro: com float, dez vezes 0,10
    // não dá exatamente 1,00
    const dez = Array.from({ length: 10 }, () => item({ done: true, amountCents: 10 }));
    assert.equal(totalContratado(dez), 100);
  });
});

describe("totalPago x totalAPagar", () => {
  it("parcelado: contratado inteiro, pago só a parte que venceu", () => {
    const items = [
      item({ done: true, amountCents: 228000, installments: 6, paidInstallments: 2 }),
    ];
    assert.equal(totalContratado(items), 228000);
    assert.equal(totalPago(items), 76000);
    assert.equal(totalAPagar(items), 152000);
  });

  it("dinheiro que saiu conta mesmo se o item não foi marcado", () => {
    // pagou o sinal da pousada mas ainda não deu por 'resolvido': o dinheiro
    // saiu do mesmo jeito e precisa aparecer
    const items = [item({ done: false, amountCents: 100000, installments: 2, paidInstallments: 1 })];
    assert.equal(totalContratado(items), 0);
    assert.equal(totalPago(items), 50000);
    // não está contratado, então não entra no "ainda vou ter que pagar"
    assert.equal(totalAPagar(items), 0);
  });

  it("à vista e pago fecha tudo", () => {
    const items = [item({ done: true, amountCents: 50000, installments: 1, paidInstallments: 1 })];
    assert.equal(totalPago(items), 50000);
    assert.equal(totalAPagar(items), 0);
  });

  it("checklist vazio não quebra", () => {
    assert.equal(totalPago([]), 0);
    assert.equal(totalAPagar([]), 0);
  });
});

describe("feitos", () => {
  it("conta os concluídos", () => {
    assert.equal(feitos([item({ done: true }), item({ done: false }), item({ done: true })]), 2);
    assert.equal(feitos([]), 0);
  });
});

describe("compararComOrcamento", () => {
  it("compara o contratado, não o pago", () => {
    // viagem inteira parcelada, quase nada pago ainda, mas já estourou:
    // comparar pelo pago diria que está dentro do orçamento
    const items = [item({ done: true, amountCents: 500000, installments: 10, paidInstallments: 1 })];
    const r = compararComOrcamento(totalContratado(items), 420000);
    assert.deepEqual(r, { diferenca: 80000, acima: true });
  });

  it("aponta quando passou do estimado", () => {
    const r = compararComOrcamento(435000, 420000);
    assert.deepEqual(r, { diferenca: 15000, acima: true });
  });

  it("aponta quando ainda está abaixo", () => {
    const r = compararComOrcamento(380000, 420000);
    assert.deepEqual(r, { diferenca: 40000, acima: false });
  });

  it("gastou exatamente o previsto não é 'acima'", () => {
    const r = compararComOrcamento(420000, 420000);
    assert.deepEqual(r, { diferenca: 0, acima: false });
  });

  it("não compara sem orçamento definido", () => {
    assert.equal(compararComOrcamento(50000, null), null);
    assert.equal(compararComOrcamento(50000, 0), null);
  });

  it("não compara enquanto nada foi gasto", () => {
    // sem isto o app anunciaria "R$ 4.200 abaixo do estimado" numa viagem
    // em que ninguém lançou nada ainda
    assert.equal(compararComOrcamento(0, 420000), null);
  });
});
