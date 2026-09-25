import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coordenadaValida, formatarCoordenada, lerCoordenada } from "./geo";

describe("coordenadaValida", () => {
  it("aceita coordenadas reais", () => {
    assert.equal(coordenadaValida(-8.2593, -34.9123), true); // Olinda
    assert.equal(coordenadaValida(-7.1195, -34.845), true); // João Pessoa
  });

  it("recusa fora da faixa", () => {
    assert.equal(coordenadaValida(91, 0), false);
    assert.equal(coordenadaValida(0, 181), false);
    assert.equal(coordenadaValida(-91, -181), false);
  });

  it("recusa o ponto nulo 0,0", () => {
    // fica no Atlântico, e na prática significa "campo não preenchido"
    assert.equal(coordenadaValida(0, 0), false);
  });

  it("recusa o que não é número", () => {
    assert.equal(coordenadaValida(null, null), false);
    assert.equal(coordenadaValida("−8", "−34"), false);
    assert.equal(coordenadaValida(NaN, 0), false);
    assert.equal(coordenadaValida(undefined, undefined), false);
  });

  it("aceita zero em um dos eixos", () => {
    // o equador e o meridiano de Greenwich existem
    assert.equal(coordenadaValida(0, -34.9), true);
    assert.equal(coordenadaValida(-8.25, 0), true);
  });
});

describe("lerCoordenada", () => {
  it("lê o que o Google Maps copia", () => {
    assert.deepEqual(lerCoordenada("-8.2593, -34.9123"), { lat: -8.2593, lng: -34.9123 });
  });

  it("tolera espaços e vírgula colada", () => {
    assert.deepEqual(lerCoordenada("  -8.2593,-34.9123 "), { lat: -8.2593, lng: -34.9123 });
  });

  it("aceita coordenada inteira", () => {
    assert.deepEqual(lerCoordenada("-8, -34"), { lat: -8, lng: -34 });
  });

  it("endereço não é coordenada", () => {
    // o texto cai para a busca por endereço em vez de virar pino errado
    assert.equal(lerCoordenada("Rua do Amparo, Olinda"), null);
    assert.equal(lerCoordenada("Casa do Junete"), null);
    assert.equal(lerCoordenada(""), null);
  });

  it("número fora da faixa não vira pino", () => {
    assert.equal(lerCoordenada("999, 999"), null);
  });
});

describe("formatarCoordenada", () => {
  it("arredonda para 5 casas — cerca de um metro", () => {
    assert.equal(formatarCoordenada(-8.259312345, -34.912387654), "-8.25931, -34.91239");
  });
});
