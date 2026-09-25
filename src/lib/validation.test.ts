import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checklistItemCreateSchema,
  registerSchema,
  tripCreateSchema,
} from "./validation";

describe("tripCreateSchema", () => {
  it("viagem sem orçamento fica null, não zero", () => {
    // regressão: o default null era reparseado pelo union e o
    // z.coerce.number() o transformava em 0 — "sem orçamento" virava "R$ 0"
    const r = tripCreateSchema.parse({ dest: "Lisboa" });
    assert.equal(r.budgetCents, null);
  });

  it("aceita orçamento em centavos", () => {
    const r = tripCreateSchema.parse({ dest: "Lisboa", budgetCents: 219047 });
    assert.equal(r.budgetCents, 219047);
  });

  it("recusa orçamento negativo", () => {
    const r = tripCreateSchema.safeParse({ dest: "Lisboa", budgetCents: -1 });
    assert.equal(r.success, false);
  });

  it("exige destino", () => {
    assert.equal(tripCreateSchema.safeParse({ dest: "   " }).success, false);
  });

  it("ano 0 é válido: significa 'algum dia'", () => {
    assert.equal(tripCreateSchema.parse({ dest: "Japão", year: 0 }).year, 0);
  });

  it("recusa ano fora de prazo plausível", () => {
    assert.equal(tripCreateSchema.safeParse({ dest: "x", year: 1500 }).success, false);
    assert.equal(tripCreateSchema.safeParse({ dest: "x", year: 3000 }).success, false);
  });

  it("people não tem default no schema: quem decide é a API, pelo tamanho do quadro", () => {
    assert.equal(tripCreateSchema.parse({ dest: "x" }).people, undefined);
  });

  it("recusa viagem com zero pessoas", () => {
    assert.equal(tripCreateSchema.safeParse({ dest: "x", people: 0 }).success, false);
  });
});

describe("checklistItemCreateSchema", () => {
  it("item novo nasce sem valor e não feito", () => {
    const r = checklistItemCreateSchema.parse({ label: "Passagem" });
    assert.equal(r.amountCents, null);
    assert.equal(r.done, false);
  });

  it("exige nome", () => {
    assert.equal(checklistItemCreateSchema.safeParse({ label: "  " }).success, false);
  });

  it("recusa valor negativo", () => {
    assert.equal(
      checklistItemCreateSchema.safeParse({ label: "x", amountCents: -5 }).success,
      false,
    );
  });
});

describe("registerSchema", () => {
  it("normaliza o email para minúsculas", () => {
    // sem isto daria para criar duas contas com o "mesmo" email
    const r = registerSchema.parse({
      name: "Fábio",
      email: "  Fabio@Email.COM ",
      password: "senha123",
    });
    assert.equal(r.email, "fabio@email.com");
  });

  it("exige senha de ao menos 6 caracteres", () => {
    const r = registerSchema.safeParse({ name: "a", email: "a@b.com", password: "123" });
    assert.equal(r.success, false);
  });

  it("recusa email inválido", () => {
    const r = registerSchema.safeParse({ name: "a", email: "nao-e-email", password: "123456" });
    assert.equal(r.success, false);
  });
});
