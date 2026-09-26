import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { telefoneDe } from "./contato";

describe("telefoneDe", () => {
  it("acha o celular no meio do nome colado do WhatsApp", () => {
    assert.equal(telefoneDe("Atlantis Divers · (81) 99777-4321"), "81997774321");
  });

  it("aceita fixo sem DDD", () => {
    assert.equal(telefoneDe("Pousada 3232-1010"), "32321010");
  });

  it("mantém o + do formato internacional", () => {
    assert.equal(telefoneDe("+55 81 99777-4321"), "+5581997774321");
  });

  it("não transforma número curto em ligação", () => {
    // Sem o piso de dígitos, "sala 302" virava um link de telefone.
    assert.equal(telefoneDe("recepção, sala 302"), null);
    assert.equal(telefoneDe("diária 180"), null);
  });

  it("não transforma número comprido demais em ligação", () => {
    assert.equal(telefoneDe("reserva 1234567890123456"), null);
  });

  it("contato sem número nenhum", () => {
    assert.equal(telefoneDe("perguntar na recepção"), null);
    assert.equal(telefoneDe(""), null);
  });
});
