import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contagem,
  diasAte,
  formatarPeriodo,
  hojeUTC,
  noites,
  paraISO,
  somarMeses,
} from "./datas";

// Data fixa para os testes: sem isto a suíte passaria hoje e quebraria amanhã.
const HOJE = new Date("2026-09-25T13:40:00-03:00");

describe("hojeUTC", () => {
  it("usa o dia do calendário de quem olha, não o instante UTC", () => {
    // 25/09 às 22h em Brasília já é 26/09 em UTC. O dia da pessoa é 25.
    assert.equal(paraISO(hojeUTC(new Date("2026-09-25T22:00:00-03:00"))), "2026-09-25");
  });

  it("madrugada não escorrega para o dia anterior", () => {
    assert.equal(paraISO(hojeUTC(new Date("2026-09-25T00:30:00-03:00"))), "2026-09-25");
  });
});

describe("diasAte", () => {
  it("conta dias inteiros até a data", () => {
    assert.equal(diasAte("2026-11-12", HOJE), 48);
  });

  it("hoje é zero, amanhã é um", () => {
    assert.equal(diasAte("2026-09-25", HOJE), 0);
    assert.equal(diasAte("2026-09-26", HOJE), 1);
  });

  it("passado é negativo", () => {
    assert.equal(diasAte("2026-09-20", HOJE), -5);
  });

  it("atravessa o horário de verão sem perder um dia", () => {
    // um ano inteiro tem 365 dias mesmo passando por mudanças de hora
    assert.equal(diasAte("2027-09-25", HOJE), 365);
  });
});

describe("noites", () => {
  it("conta as noites entre ida e volta", () => {
    assert.equal(noites("2026-11-12", "2026-11-19"), 7);
  });

  it("ida e volta no mesmo dia é bate-volta: zero noites", () => {
    assert.equal(noites("2026-11-12", "2026-11-12"), 0);
  });

  it("sem uma das pontas não dá para saber", () => {
    assert.equal(noites("2026-11-12", null), null);
    assert.equal(noites(null, "2026-11-19"), null);
  });

  it("volta antes da ida é inválido, não negativo", () => {
    assert.equal(noites("2026-11-19", "2026-11-12"), null);
  });
});

describe("formatarPeriodo", () => {
  it("mesmo mês não repete o mês", () => {
    assert.equal(formatarPeriodo("2026-11-12", "2026-11-19"), "12 a 19 de nov de 2026");
  });

  it("meses diferentes no mesmo ano mostram os dois meses", () => {
    assert.equal(formatarPeriodo("2026-11-28", "2026-12-03"), "28 de nov a 3 de dez de 2026");
  });

  it("virada de ano mostra os dois anos", () => {
    assert.equal(formatarPeriodo("2026-12-28", "2027-01-03"), "28 de dez de 2026 a 3 de jan de 2027");
  });

  it("só ida mostra uma data", () => {
    assert.equal(formatarPeriodo("2026-11-12", null), "12 de nov de 2026");
  });

  it("sem data nenhuma não inventa texto", () => {
    assert.equal(formatarPeriodo(null, null), null);
  });

  it("não escorrega de dia por causa de fuso", () => {
    // o bug clássico: formatar UTC no fuso local e voltar para o dia 11
    assert.match(formatarPeriodo("2026-11-12", null)!, /^12 de nov/);
  });
});

describe("contagem", () => {
  it("viagem distante mostra os dias que faltam", () => {
    assert.deepEqual(contagem("2026-11-12", "2026-11-19", HOJE), {
      txt: "faltam 48 dias",
      estado: "futuro",
    });
  });

  it("véspera e dia têm frase própria", () => {
    assert.equal(contagem("2026-09-26", null, HOJE)?.txt, "é amanhã");
    assert.equal(contagem("2026-09-25", null, HOJE)?.txt, "é hoje");
  });

  it("viagem que começou e ainda não terminou está em andamento", () => {
    // sem olhar a volta, o app diria que a viagem "já passou" no segundo dia
    const c = contagem("2026-09-23", "2026-09-30", HOJE);
    assert.deepEqual(c, { txt: "em andamento", estado: "andamento" });
  });

  it("último dia ainda conta como em andamento", () => {
    assert.equal(contagem("2026-09-20", "2026-09-25", HOJE)?.estado, "andamento");
  });

  it("depois de terminada, conta o tempo desde o fim", () => {
    assert.equal(contagem("2026-09-10", "2026-09-24", HOJE)?.txt, "terminou ontem");
    assert.equal(contagem("2026-09-01", "2026-09-15", HOJE)?.txt, "há 10 dias");
    assert.equal(contagem("2026-05-01", "2026-05-15", HOJE)?.txt, "há 4 meses");
  });

  it("viagem só com ida, já passada", () => {
    assert.equal(contagem("2026-09-20", null, HOJE)?.estado, "passado");
  });

  it("sem data não há contagem", () => {
    assert.equal(contagem(null, null, HOJE), null);
  });
});

describe("somarMeses", () => {
  it("soma meses normalmente", () => {
    assert.equal(somarMeses("2026-01-10", 1), "2026-02-10");
    assert.equal(somarMeses("2026-01-10", 6), "2026-07-10");
  });

  it("atravessa a virada de ano", () => {
    assert.equal(somarMeses("2026-11-15", 3), "2027-02-15");
  });

  it("gruda no último dia quando o mês de destino é mais curto", () => {
    // 31 de janeiro + 1 mês não existe: a aritmética ingênua cairia em 3 de
    // março, o que faria uma parcela vencer no mês errado
    assert.equal(somarMeses("2026-01-31", 1), "2026-02-28");
    assert.equal(somarMeses("2026-03-31", 1), "2026-04-30");
  });

  it("respeita ano bissexto", () => {
    assert.equal(somarMeses("2028-01-31", 1), "2028-02-29");
  });

  it("somar zero devolve a mesma data", () => {
    assert.equal(somarMeses("2026-05-20", 0), "2026-05-20");
  });
});
