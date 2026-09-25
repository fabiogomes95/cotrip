import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { coordenadaValida } from "@/lib/geo";

/**
 * Busca um endereço no Nominatim (OpenStreetMap).
 *
 * Passa pelo servidor em vez de o navegador chamar direto por três motivos:
 *
 * 1. A política de uso do Nominatim exige um User-Agent que identifique a
 *    aplicação. O navegador manda o dele, não o nosso.
 * 2. Chamando do cliente, o endereço pesquisado e o IP de quem pesquisa vão
 *    direto para um terceiro. Daqui, sai o IP do servidor.
 * 3. Dá para limitar o uso — o serviço é gratuito e mantido por doação, e
 *    abusar dele é a forma mais rápida de todo mundo perder o acesso.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  // Exigir sessão impede que a rota vire um proxy de geocodificação aberto.
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limite = await rateLimit(clientKey(req, "geocode"), 30, 60);
  if (!limite.ok) {
    return NextResponse.json(
      { error: "Muitas buscas seguidas. Tente de novo daqui a pouco." },
      { status: 429 },
    );
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ error: "Escreva um pouco mais" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  // Prioriza resultados no Brasil sem excluir o resto: viagem internacional
  // continua achável, mas "Olinda" resolve para Pernambuco, não para Espanha.
  url.searchParams.set("countrycodes", "br,pt,ar,cl,uy,es,it,fr,jp,us");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CoTrip/1.0 (https://cotrip-chi.vercel.app)",
        "Accept-Language": "pt-BR,pt",
      },
      // O serviço é gratuito e às vezes lento; melhor desistir do que deixar
      // a pessoa esperando com a tela travada.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);

    const bruto: unknown = await res.json();
    const lista = Array.isArray(bruto) ? bruto : [];

    const resultados = lista
      .map((r: Record<string, unknown>) => ({
        nome: String(r.display_name ?? ""),
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((r) => r.nome && coordenadaValida(r.lat, r.lng));

    return NextResponse.json({ resultados });
  } catch (e) {
    console.error("Falha ao buscar endereço:", e);
    return NextResponse.json(
      { error: "Não deu para buscar agora. Você pode colar a coordenada." },
      { status: 502 },
    );
  }
}
