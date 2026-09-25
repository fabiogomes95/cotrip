import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paraTextoSimples, temFormatacao } from "./markdown";

describe("paraTextoSimples", () => {
  it("tira negrito e itálico", () => {
    assert.equal(paraTextoSimples("**Dia 1** foi _incrível_"), "Dia 1 foi incrível");
  });

  it("tira títulos", () => {
    assert.equal(paraTextoSimples("## Dia 2\nFomos à praia"), "Dia 2 Fomos à praia");
  });

  it("tira marcadores de lista", () => {
    assert.equal(
      paraTextoSimples("- passeio de barco\n- pôr do sol"),
      "passeio de barco pôr do sol",
    );
  });

  it("tira lista numerada e de tarefas", () => {
    assert.equal(paraTextoSimples("1. chegada\n2. almoço"), "chegada almoço");
    assert.equal(paraTextoSimples("- [x] comprei\n- [ ] falta"), "comprei falta");
  });

  it("link vira só o texto, imagem some", () => {
    assert.equal(paraTextoSimples("veja [a pousada](http://x.com)"), "veja a pousada");
    assert.equal(paraTextoSimples("![foto](http://x.com/a.jpg) legenda"), "legenda");
  });

  it("tira citação, código e linha horizontal", () => {
    assert.equal(paraTextoSimples("> ele disse isso"), "ele disse isso");
    assert.equal(paraTextoSimples("rode `npm test` aí"), "rode npm test aí");
    assert.equal(paraTextoSimples("Dia 1\n\n---\n\nDia 2"), "Dia 1 Dia 2");
  });

  it("junta tudo numa linha só, sem espaço sobrando", () => {
    const md = "# Jampa\n\n- casa do **Junete**\n- praia\n\n\nFoi ótimo.";
    assert.equal(paraTextoSimples(md), "Jampa casa do Junete praia Foi ótimo.");
  });

  it("texto sem marcação passa intacto", () => {
    // o que já está guardado hoje não pode mudar de aparência
    const antigo = "Mergulho na Baía do Sancho, trilha do Atalaia.";
    assert.equal(paraTextoSimples(antigo), antigo);
  });

  it("não engasga com texto vazio", () => {
    assert.equal(paraTextoSimples(""), "");
    assert.equal(paraTextoSimples("   \n  "), "");
  });

  it("asterisco solto não é ênfase e fica", () => {
    assert.equal(paraTextoSimples("2 * 3 = 6"), "2 * 3 = 6");
  });
});

describe("temFormatacao", () => {
  it("detecta quando vale renderizar", () => {
    assert.equal(temFormatacao("## Dia 1"), true);
    assert.equal(temFormatacao("texto simples"), false);
  });
});
