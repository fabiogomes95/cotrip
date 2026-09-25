import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centavosParaCampo, formatBRL, parseCentavos, yearLabel } from "./format";

describe("parseCentavos", () => {
  it("lê número inteiro como reais", () => {
    assert.equal(parseCentavos("2190"), 219000);
  });

  it("aceita vírgula decimal, que é como se escreve em português", () => {
    assert.equal(parseCentavos("2190,47"), 219047);
  });

  it("aceita ponto decimal, de quem usa teclado em inglês", () => {
    assert.equal(parseCentavos("2190.47"), 219047);
  });

  it("descarta o ponto de milhar sem confundir com decimal", () => {
    assert.equal(parseCentavos("2.190,47"), 219047);
    assert.equal(parseCentavos("1.000"), 100000);
    // este é o caso traiçoeiro: 3 dígitos depois do ponto é milhar,
    // 2 dígitos é centavo
    assert.equal(parseCentavos("1.00"), 100);
  });

  it("tolera o que a pessoa cola de outro lugar", () => {
    assert.equal(parseCentavos("R$ 4.200"), 420000);
    assert.equal(parseCentavos("  380  "), 38000);
  });

  it("devolve null para vazio ou lixo, e nunca 0 por engano", () => {
    // a diferença importa: null é "não sei quanto", 0 é "foi de graça"
    assert.equal(parseCentavos(""), null);
    assert.equal(parseCentavos("   "), null);
    assert.equal(parseCentavos("abc"), null);
    assert.equal(parseCentavos("-50"), null);
  });

  it("zero digitado é zero de verdade", () => {
    assert.equal(parseCentavos("0"), 0);
  });

  it("arredonda para o centavo, sem deixar fração escapar", () => {
    assert.equal(parseCentavos("10,005"), 1001);
    assert.equal(parseCentavos("10,004"), 1000);
  });
});

describe("formatBRL", () => {
  it("omite os centavos quando o valor é redondo", () => {
    assert.match(formatBRL(420000), /^R\$.4\.200$/);
  });

  it("mostra os centavos quando existem", () => {
    assert.match(formatBRL(219047), /^R\$.2\.190,47$/);
  });

  it("mostra travessão para vazio, zero e negativo", () => {
    assert.equal(formatBRL(null), "—");
    assert.equal(formatBRL(undefined), "—");
    assert.equal(formatBRL(0), "—");
    assert.equal(formatBRL(-100), "—");
  });
});

describe("ida e volta pelo campo de edição", () => {
  it("o que sai do campo volta igual", () => {
    // esta é a garantia que impede um valor mudar sozinho a cada abre-e-fecha
    for (const centavos of [0, 1, 100, 38000, 219047, 1500000]) {
      assert.equal(
        parseCentavos(centavosParaCampo(centavos)),
        centavos,
        `falhou em ${centavos}`,
      );
    }
  });

  it("campo vazio para valor não informado", () => {
    assert.equal(centavosParaCampo(null), "");
  });
});

describe("yearLabel", () => {
  it("ano 0 significa sem data marcada", () => {
    assert.equal(yearLabel(0), "Algum dia");
    assert.equal(yearLabel(2027), "2027");
  });
});
