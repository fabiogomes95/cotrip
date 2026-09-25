/* ============================================================
   Coordenadas

   Validação e formatação ficam aqui, fora do componente do mapa: o mapa é
   client-only e pesado, e estas contas precisam rodar no servidor (para
   validar o que chega da API) e nos testes.
   ============================================================ */

/** Faixas válidas de latitude e longitude. */
export function coordenadaValida(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // 0,0 é o "ponto nulo" no Atlântico: quase sempre significa coordenada
    // não preenchida, não uma viagem para o meio do oceano.
    !(lat === 0 && lng === 0)
  );
}

/** "-8.2593, -34.9123" — o formato que se cola no Google Maps. */
export function formatarCoordenada(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Lê coordenadas coladas de outro lugar.
 *
 * Aceita o que o Google Maps e o WhatsApp produzem: "-8.2593, -34.9123",
 * "-8.2593,-34.9123" e com espaços sobrando. Devolve null se não for isso —
 * aí o texto é tratado como endereço para busca.
 */
export function lerCoordenada(texto: string): { lat: number; lng: number } | null {
  const m = texto.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return coordenadaValida(lat, lng) ? { lat, lng } : null;
}

/** Link para abrir o ponto no app de mapas do celular. */
export function linkMapa(lat: number, lng: number, nome?: string): string {
  const q = encodeURIComponent(nome ? `${nome}` : `${lat},${lng}`);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}&q=${q}`;
}
