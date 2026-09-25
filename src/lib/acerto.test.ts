import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularSaldos, sugerirPagamentos } from "./acerto";
import type { ItemAcerto, Pessoa } from "./acerto";

const ANA: Pessoa = { userId: "ana", name: "Ana" };
const BRUNO: Pessoa = { userId: "bruno", name: "Bruno" };
const CIDA: Pessoa = { userId: "cida", name: "Cida" };

function item(p: Partial<ItemAcerto> = {}): ItemAcerto {
  return {
    amountCents: null,
    downPaymentCents: null,
    downPaymentPaid: false,
    installments: 1,
    paidInstallments: 0,
    paidById: null,
    ...p,
  };
}

/** Um item à vista, já pago por alguém. */
function pago(valorPorPessoa: number, quem: string): ItemAcerto {
  return item({ amountCents: valorPorPessoa, installments: 1, paidInstallments: 1, paidById: quem });
}

describe("calcularSaldos", () => {
  it("quem pagou tudo tem a receber metade", () => {
    // R$ 1.000 por pessoa, 2 pessoas = R$ 2.000 saíram do bolso da Ana
    const s = calcularSaldos([pago(100000, "ana")], [], [ANA, BRUNO], 2);
    const ana = s.find((x) => x.userId === "ana")!;
    const bruno = s.find((x) => x.userId === "bruno")!;
    assert.equal(ana.desembolsou, 200000);
    assert.equal(ana.parte, 100000);
    assert.equal(ana.saldo, 100000);
    assert.equal(bruno.saldo, -100000);
  });

  it("gastos equilibrados zeram o acerto", () => {
    const s = calcularSaldos([pago(50000, "ana"), pago(50000, "bruno")], [], [ANA, BRUNO], 2);
    assert.deepEqual(s.map((x) => x.saldo), [0, 0]);
  });

  it("só conta o que já foi pago, não o contratado", () => {
    // passagem parcelada em 4x, nenhuma paga: ninguém deve nada ainda
    const s = calcularSaldos([item({ amountCents: 400000, installments: 4, paidInstallments: 0, paidById: "ana" })], [], [ANA, BRUNO], 2);
    assert.deepEqual(s.map((x) => x.saldo), [0, 0]);
  });

  it("parcelado conta só as parcelas já pagas", () => {
    // 2 de 4 parcelas pagas de um item de R$ 400/pessoa, 2 pessoas:
    // saíram R$ 200 × 2 = R$ 400
    const s = calcularSaldos([item({ amountCents: 40000, installments: 4, paidInstallments: 2, paidById: "ana" })], [], [ANA, BRUNO], 2);
    assert.equal(s.find((x) => x.userId === "ana")!.desembolsou, 40000);
    assert.equal(s.find((x) => x.userId === "bruno")!.saldo, -20000);
  });

  it("item pago sem dono entra no total mas não credita ninguém", () => {
    const s = calcularSaldos([pago(100000, null as unknown as string)], [], [ANA, BRUNO], 2);
    // os dois ficam devendo a própria parte a ninguém — o saldo reflete isso
    assert.equal(s.find((x) => x.userId === "ana")!.desembolsou, 0);
    assert.equal(s.find((x) => x.userId === "ana")!.parte, 100000);
  });

  it("as partes sempre somam o total, sem centavo fantasma", () => {
    // 3 pessoas dividindo R$ 100,00: 33,34 + 33,33 + 33,33
    const s = calcularSaldos([pago(10000, "ana")], [], [ANA, BRUNO, CIDA], 1);
    assert.equal(s.reduce((t, x) => t + x.parte, 0), 10000);
    assert.equal(s.reduce((t, x) => t + x.saldo, 0), 0);
  });

  it("quadro sem membros não quebra", () => {
    assert.deepEqual(calcularSaldos([pago(1000, "ana")], [], [], 2), []);
  });

  it("a soma de todos os saldos é sempre zero", () => {
    // invariante do acerto: o que uns têm a receber, outros devem
    const s = calcularSaldos([pago(12345, "ana"), pago(6789, "bruno"), pago(101, "cida")], [], [ANA, BRUNO, CIDA], 3);
    assert.equal(s.reduce((t, x) => t + x.saldo, 0), 0);
  });
});

describe("gastos avulsos no acerto", () => {
  it("entram com o valor CHEIO, sem multiplicar por pessoa", () => {
    // a armadilha: o checklist guarda por pessoa e é multiplicado; o gasto
    // avulso já é o valor da carteira. Multiplicar os dois dobraria o Uber.
    const s = calcularSaldos([], [{ totalCents: 4000, paidById: "ana" }], [ANA, BRUNO], 2);
    assert.equal(s.find((x) => x.userId === "ana")!.desembolsou, 4000);
    assert.equal(s.find((x) => x.userId === "ana")!.saldo, 2000);
  });

  it("somam junto com o checklist", () => {
    const s = calcularSaldos(
      [pago(50000, "ana")], // R$ 500/pessoa × 2 = R$ 1.000
      [{ totalCents: 20000, paidById: "bruno" }], // R$ 200 cheios
      [ANA, BRUNO],
      2,
    );
    assert.equal(s.find((x) => x.userId === "ana")!.desembolsou, 100000);
    assert.equal(s.find((x) => x.userId === "bruno")!.desembolsou, 20000);
    // total 1.200, parte de 600 para cada
    assert.equal(s.find((x) => x.userId === "ana")!.parte, 60000);
    assert.equal(s.reduce((t, x) => t + x.saldo, 0), 0);
  });

  it("gasto sem dono entra no total mas não credita ninguém", () => {
    const s = calcularSaldos([], [{ totalCents: 10000, paidById: null }], [ANA, BRUNO], 2);
    assert.equal(s.every((x) => x.desembolsou === 0), true);
    assert.equal(s.every((x) => x.parte === 5000), true);
  });
});

describe("sugerirPagamentos", () => {
  it("um deve, um recebe", () => {
    const s = calcularSaldos([pago(100000, "ana")], [], [ANA, BRUNO], 2);
    assert.deepEqual(sugerirPagamentos(s), [
      { de: "Bruno", para: "Ana", valor: 100000 },
    ]);
  });

  it("acerto zerado não sugere nada", () => {
    const s = calcularSaldos([pago(50000, "ana"), pago(50000, "bruno")], [], [ANA, BRUNO], 2);
    assert.deepEqual(sugerirPagamentos(s), []);
  });

  it("três pessoas resolvem em no máximo duas transferências", () => {
    const s = calcularSaldos([pago(30000, "ana")], [], [ANA, BRUNO, CIDA], 3);
    const t = sugerirPagamentos(s);
    assert.ok(t.length <= 2, `deu ${t.length} transferências`);
    // e o que a Ana recebe fecha com o saldo dela
    const recebe = t.filter((x) => x.para === "Ana").reduce((n, x) => n + x.valor, 0);
    assert.equal(recebe, s.find((x) => x.userId === "ana")!.saldo);
  });

  it("as transferências zeram todos os saldos", () => {
    const s = calcularSaldos([pago(90000, "ana"), pago(10000, "cida")], [], [ANA, BRUNO, CIDA], 3);
    const t = sugerirPagamentos(s);
    const final = new Map(s.map((x) => [x.name, x.saldo]));
    for (const { de, para, valor } of t) {
      final.set(de, final.get(de)! + valor);
      final.set(para, final.get(para)! - valor);
    }
    for (const [nome, v] of final) assert.equal(v, 0, `${nome} não zerou`);
  });
});
