import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GRADIENTES, gradeDeTiles, gradienteDe, hashTexto, paraTile } from "./capa";

describe("gradienteDe", () => {
  it("o mesmo destino dá sempre a mesma cor", () => {
    // o ponto de ser determinístico: nada é guardado no banco, e a cor
    // precisa ser igual em qualquer aparelho e em qualquer recarga
    assert.deepEqual(gradienteDe("Olinda"), gradienteDe("Olinda"));
  });

  it("ignora caixa e espaços em volta", () => {
    assert.deepEqual(gradienteDe("  OLINDA "), gradienteDe("olinda"));
  });

  it("destinos diferentes tendem a cores diferentes", () => {
    const nomes = ["Olinda", "João Pessoa", "Noronha", "Jericoacoara",
                   "Buenos Aires", "Lisboa", "Japão", "Chapada"];
    const cores = new Set(nomes.map((n) => gradienteDe(n)[0]));
    // com 8 pares e 8 nomes, colisão é possível; exigir variedade razoável
    assert.ok(cores.size >= 5, `só ${cores.size} cores distintas em 8 destinos`);
  });

  it("sempre devolve um par da paleta", () => {
    for (const n of ["", "a", "destino com nome bem comprido aqui"]) {
      assert.ok(GRADIENTES.some((g) => g[0] === gradienteDe(n)[0]));
    }
  });
});

describe("hashTexto", () => {
  it("é estável", () => {
    assert.equal(hashTexto("olinda"), hashTexto("olinda"));
  });
  it("nunca é negativo", () => {
    // sem o >>> 0 daria índice negativo e quebraria o acesso à paleta
    for (const s of ["x", "zzzzzzzzzzzzzzzzzzzz", "ação", "🏖️"]) {
      assert.ok(hashTexto(s) >= 0, `negativo em ${s}`);
    }
  });
});

describe("paraTile", () => {
  it("o meridiano de Greenwich no equador cai no meio do mundo", () => {
    const t = paraTile(0, 0, 1);
    assert.equal(t.x, 1);
    assert.ok(Math.abs(t.y - 1) < 1e-9);
  });

  it("converte um ponto real", () => {
    // Olinda, zoom 13. Valores conferidos contra a fórmula padrão do
    // slippy map, calculada por fora.
    const t = paraTile(-8.0089, -34.8553, 13);
    assert.equal(Math.floor(t.x), 3302);
    assert.equal(Math.floor(t.y), 4278);
  });

  it("o hemisfério sul fica na metade de baixo", () => {
    assert.ok(paraTile(-30, 0, 4).y > 2 ** 4 / 2);
  });
});

describe("gradeDeTiles", () => {
  it("devolve quatro tiles", () => {
    assert.equal(gradeDeTiles(-8.0089, -34.8553).tiles.length, 4);
  });

  it("o ponto cai dentro da grade, não na borda", () => {
    // é para isso que existem os 4 tiles: com um só, o lugar apareceria no
    // canto da capa
    for (const [lat, lng] of [[-8.0089, -34.8553], [-3.8669, -32.428],
                              [35.6762, 139.6503], [38.7223, -9.1393]] as const) {
      const g = gradeDeTiles(lat, lng);
      assert.ok(g.pontoX > 0 && g.pontoX < g.largura, `X fora em ${lat}`);
      assert.ok(g.pontoY > 0 && g.pontoY < g.altura, `Y fora em ${lat}`);
    }
  });

  it("o ponto fica perto do centro, em qualquer tamanho de grade", () => {
    // no máximo meio tile de desvio; com `floor` no lugar de `round` chegava
    // a um tile inteiro e o lugar aparecia na beira da capa
    for (const [cols, rows] of [[2, 2], [3, 2], [4, 2], [1, 1]] as const) {
      for (const [lat, lng] of [[-8.0089, -34.8553], [-3.8669, -32.428],
                                [35.6762, 139.6503]] as const) {
        const g = gradeDeTiles(lat, lng, 13, cols, rows);
        assert.ok(Math.abs(g.pontoX - g.largura / 2) <= 128, `X em ${cols}x${rows} @ ${lat}`);
        assert.ok(Math.abs(g.pontoY - g.altura / 2) <= 128, `Y em ${cols}x${rows} @ ${lat}`);
      }
    }
  });

  it("cobre o painel largo, mesmo com a grade deslocada", () => {
    /* A capa é posicionada por `left: calc(50% - pontoX)`, então o que
       sobra de cada lado é pontoX à esquerda e (largura - pontoX) à
       direita. As duas sobras precisam alcançar a metade do painel, senão
       aparece uma faixa sem mapa numa das pontas.

       O painel mais largo que existe: .wrap tem max-width 1060px e 16px de
       padding de cada lado.

       Varre o globo em vez de listar cidades: o que decide para que lado a
       grade escorrega é a parte fracionária da coordenada de tile, e uma
       lista de lugares conhecidos pode passar longe dos dois extremos —
       foi o que aconteceu na primeira versão deste teste, que passava
       mesmo com a grade estreita demais. */
    const PAINEL = 1060 - 32;
    const metade = PAINEL / 2;

    let piorEsq = Infinity;
    let piorDir = Infinity;
    for (let i = 0; i < 360; i++) {
      const lng = -180 + i * (360 / 360);
      for (const lat of [-60, -23.5, -5.1, 0, 35.7, 64.1]) {
        const g = gradeDeTiles(lat, lng, 12, 6, 2);
        piorEsq = Math.min(piorEsq, g.pontoX);
        piorDir = Math.min(piorDir, g.largura - g.pontoX);
      }
    }
    assert.ok(piorEsq >= metade, `pior sobra à esquerda: ${piorEsq} < ${metade}`);
    assert.ok(piorDir >= metade, `pior sobra à direita: ${piorDir} < ${metade}`);
  });

  it("respeita o tamanho de grade pedido", () => {
    const g = gradeDeTiles(-8.0089, -34.8553, 13, 3, 2);
    assert.equal(g.tiles.length, 6);
    assert.equal(g.largura, 768);
    assert.equal(g.colunas, 3);
  });

  it("dá a volta no meridiano 180 sem pedir tile negativo", () => {
    // Fiji: sem o módulo cíclico, x viraria -1 e a imagem não existiria
    const g = gradeDeTiles(-17.7134, 178.065, 5);
    assert.ok(g.tiles.every((t) => t.x >= 0 && t.y >= 0), "tile negativo");
  });

  it("não pede tile além do polo", () => {
    const g = gradeDeTiles(85, 0, 3);
    const max = 2 ** 3 - 1;
    assert.ok(g.tiles.every((t) => t.y >= 0 && t.y <= max), "tile fora do mundo");
  });

  it("monta a URL do OpenStreetMap", () => {
    const t = gradeDeTiles(-8.0089, -34.8553, 13).tiles[0]!;
    assert.match(t.url, /^https:\/\/tile\.openstreetmap\.org\/13\/\d+\/\d+\.png$/);
  });
});
