"use client";

import { gradeDeTiles, gradienteDe } from "@/lib/capa";
import { coordenadaValida } from "@/lib/geo";

/**
 * A faixa visual no topo de um cartão de viagem.
 *
 * Mapa quando a hospedagem tem coordenada; cor derivada do nome quando não
 * tem. Nunca fica em branco — um cartão sem capa quebraria o ritmo da grade.
 */

/** "Fernando de Noronha" → "FN". Uma letra quando é palavra só. */
function iniciais(dest: string): string {
  const palavras = dest
    .trim()
    .split(/\s+/)
    // "de", "do", "e" não viram inicial: "Fernando de Noronha" é FN, não FDN
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ý]/.test(p))
    .filter((p) => !/^(de|do|da|dos|das|e)$/i.test(p));
  return palavras
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("pt-BR"))
    .join("");
}

export function Capa({
  dest,
  lat,
  lng,
  className = "",
  larga = false,
}: {
  dest: string;
  lat: number | null;
  lng: number | null;
  className?: string;
  /** Painel de destaque: precisa de uma grade maior para preencher a faixa. */
  larga?: boolean;
}) {
  if (!coordenadaValida(lat, lng)) {
    const [a, b] = gradienteDe(dest);
    return (
      <div
        className={`capa capa-cor ${className}`}
        style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}
        aria-hidden="true"
      >
        <span className="iniciais">{iniciais(dest)}</span>
      </div>
    );
  }

  /* O cartão tem ~340px e a grade 2×2 (512px) sobra. O painel passa de
     1000px e ficaria com o mapa só na metade esquerda — daí a grade maior,
     que é a única diferença entre as duas chamadas. O zoom cai junto: num
     painel largo, enquadrar a cidade diz mais que enquadrar a rua. */
  const g = larga
    ? gradeDeTiles(lat!, lng!, 12, 5, 2)
    : gradeDeTiles(lat!, lng!, 13, 2, 2);
  return (
    <div className={`capa capa-mapa ${className}`} aria-hidden="true">
      {/* A grade é posicionada de modo que o ponto caia no centro da faixa. */}
      <div
        className="tiles"
        style={{
          width: g.largura,
          height: g.altura,
          gridTemplateColumns: `repeat(${g.colunas}, 256px)`,
          left: `calc(50% - ${g.pontoX}px)`,
          top: `calc(50% - ${g.pontoY}px)`,
        }}
      >
        {g.tiles.map((t) => (
          /* <img> e não next/image: são tiles de um domínio externo, servidos
             já no tamanho certo. Passar pelo otimizador da Vercel gastaria
             cota para reprocessar imagem que já está pronta. */
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.url} src={t.url} alt="" width={256} height={256} loading="lazy" />
        ))}
      </div>
      <span className="pino" />
    </div>
  );
}
