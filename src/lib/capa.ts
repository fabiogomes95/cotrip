/* ============================================================
   Capa do cartão

   Cada viagem ganha uma faixa visual no topo. Duas fontes, nesta ordem:

   1. O mapa do lugar, quando a hospedagem tem coordenada. É a capa mais
      informativa que dá para ter sem pedir foto para ninguém.
   2. Uma cor derivada do nome do destino. Determinística: "Olinda" é sempre
      a mesma cor, em qualquer aparelho, sem guardar nada no banco.
   ============================================================ */

/**
 * Paleta fechada, escolhida a dedo a partir das cores do app.
 *
 * Não gero matiz aleatório a partir do hash: isso produz verde-limão e
 * rosa-choque no meio de uma interface bege e cria a sensação de "cor
 * sorteada". Oito pares curados parecem escolha de design, e com poucas
 * viagens a repetição quase não aparece.
 */
export const GRADIENTES: ReadonlyArray<readonly [string, string]> = [
  ["#0f857a", "#1b9e8f"], // teal, a cor da casa
  ["#e1823b", "#d96b4a"], // pôr do sol
  ["#2f6f8f", "#3f8fa8"], // mar fundo
  ["#8a6fae", "#a487c4"], // fim de tarde
  ["#c9603f", "#e0834f"], // terra
  ["#3d7a5c", "#57996f"], // mata
  ["#b8546b", "#d1738a"], // flor
  ["#5a6b8c", "#7787a8"], // serra
  ["#1f7a6b", "#2f9c7d"], // água parada
  ["#a8613a", "#c2814f"], // areia molhada
  ["#4a5f9e", "#6b7fb8"], // madrugada
  ["#7a8f3d", "#96a955"], // cerrado
  ["#9e4f8a", "#b86fa4"], // buganvília
  ["#3f6d7a", "#568d99"], // chuva
];

/**
 * Hash estável de uma string.
 *
 * djb2, escolhido por ser curto e espalhar bem em textos curtos. O `>>> 0`
 * no fim mantém o número sem sinal — sem ele, destinos diferentes podiam
 * cair em índice negativo.
 */
export function hashTexto(texto: string): number {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** O par de cores de um destino. Sempre o mesmo para o mesmo nome. */
export function gradienteDe(destino: string): readonly [string, string] {
  const chave = destino.trim().toLocaleLowerCase("pt-BR");
  return GRADIENTES[hashTexto(chave) % GRADIENTES.length]!;
}

/* ------------------------------------------------------------------
   Tiles do OpenStreetMap

   O mapa da capa é estático: algumas imagens de tile, sem Leaflet. Um mapa
   interativo por cartão seria uma instância de biblioteca por viagem na
   tela — caro e sem propósito, porque ninguém arrasta o mapa de uma capa.
   ------------------------------------------------------------------ */

export const TILE_PX = 256;

/** Coordenada de tile em ponto flutuante (a parte fracionária é o pixel). */
export function paraTile(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

export type Tile = { x: number; y: number; z: number; url: string };

/**
 * A grade 2×2 de tiles que cobre o ponto, e onde ele cai dentro dela.
 *
 * 2×2 em vez de um tile só porque o ponto pode estar na beira: com um tile
 * apenas, o lugar apareceria no canto da capa ou fora dela. Quatro imagens
 * garantem que o ponto sempre tenha vizinhança em volta.
 */
export function gradeDeTiles(
  lat: number,
  lng: number,
  zoom = 13,
  colunas = 2,
  linhas = 2,
): {
  tiles: Tile[];
  pontoX: number;
  pontoY: number;
  largura: number;
  altura: number;
  colunas: number;
} {
  const { x: xf, y: yf } = paraTile(lat, lng, zoom);
  const n = 2 ** zoom;

  /* Canto superior esquerdo: recua meia grade a partir do ponto.
     `round` e não `floor` — com floor, numa grade de 2 colunas o ponto podia
     cair a um tile inteiro do centro, e a capa mostrava o lugar na beira. */
  const x0 = Math.round(xf - colunas / 2);
  const y0 = Math.round(yf - linhas / 2);

  const tiles: Tile[] = [];
  for (let dy = 0; dy < linhas; dy++) {
    for (let dx = 0; dx < colunas; dx++) {
      // O eixo X do mundo é cíclico (dá a volta no meridiano 180).
      const tx = ((x0 + dx) % n + n) % n;
      const ty = Math.min(Math.max(y0 + dy, 0), n - 1);
      tiles.push({
        x: tx,
        y: ty,
        z: zoom,
        url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
      });
    }
  }

  return {
    tiles,
    pontoX: (xf - x0) * TILE_PX,
    pontoY: (yf - y0) * TILE_PX,
    largura: TILE_PX * colunas,
    altura: TILE_PX * linhas,
    colunas,
  };
}
