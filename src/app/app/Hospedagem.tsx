"use client";

import dynamic from "next/dynamic";
import { coordenadaValida, formatarCoordenada, lerCoordenada, linkMapa } from "@/lib/geo";
import { useState } from "react";


/* O Leaflet só funciona no navegador (usa `window` no próprio módulo) e pesa
   o bastante para não valer no pacote de quem nunca abre a hospedagem. */
const MapaHospedagem = dynamic(
  () => import("@/components/MapaHospedagem").then((m) => m.MapaHospedagem),
  { ssr: false, loading: () => <div className="mapa carregando">Carregando o mapa…</div> },
);

export function Hospedagem({
  nome,
  endereco,
  lat,
  lng,
  onNome,
  onEndereco,
  onPonto,
}: {
  nome: string;
  endereco: string;
  lat: number | null;
  lng: number | null;
  onNome: (v: string) => void;
  onEndereco: (v: string) => void;
  onPonto: (lat: number | null, lng: number | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [achados, setAchados] = useState<
    Array<{ nome: string; lat: number; lng: number }>
  >([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const temPonto = coordenadaValida(lat, lng);

  async function procurar() {
    const q = busca.trim();
    if (q.length < 3) return;

    // Coordenada colada não precisa de busca nenhuma: vira pino direto.
    const coord = lerCoordenada(q);
    if (coord) {
      onPonto(coord.lat, coord.lng);
      setBusca("");
      setAchados([]);
      setAviso(null);
      return;
    }

    setBuscando(true);
    setAviso(null);
    setAchados([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAviso(data.error ?? "Não deu para buscar");
        return;
      }
      if (!data.resultados?.length) {
        setAviso("Nada encontrado. Tente o endereço da rua, ou cole a coordenada.");
        return;
      }
      setAchados(data.resultados);
    } catch {
      setAviso("Não deu para buscar agora. Você pode colar a coordenada.");
    } finally {
      setBuscando(false);
    }
  }

  function escolher(r: { nome: string; lat: number; lng: number }) {
    onPonto(r.lat, r.lng);
    if (!endereco.trim()) onEndereco(r.nome);
    setAchados([]);
    setBusca("");
  }

  return (
    <div className="field hosp">
      <label htmlFor="h-nome">Hospedagem</label>

      <input
        id="h-nome"
        type="text"
        value={nome}
        onChange={(e) => onNome(e.target.value)}
        placeholder="Casa do primo Junete, Pousada do Vale…"
        autoComplete="off"
      />

      <input
        className="hosp-end"
        type="text"
        value={endereco}
        onChange={(e) => onEndereco(e.target.value)}
        placeholder="endereço, ponto de referência"
        autoComplete="off"
        aria-label="Endereço da hospedagem"
      />

      <div className="hosp-busca">
        <input
          className="campo"
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void procurar();
            }
          }}
          placeholder="buscar no mapa, ou colar -8.2593, -34.9123"
          autoComplete="off"
          aria-label="Buscar endereço no mapa"
        />
        <button
          type="button"
          className="btn"
          onClick={() => void procurar()}
          disabled={buscando || busca.trim().length < 3}
        >
          {buscando ? "…" : "Buscar"}
        </button>
      </div>

      {achados.length > 0 && (
        <ul className="hosp-achados">
          {achados.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => escolher(r)}>
                {r.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso && <p className="check-erro">{aviso}</p>}

      {temPonto ? (
        <>
          <MapaHospedagem
            lat={lat!}
            lng={lng!}
            onMover={(la, ln) => onPonto(la, ln)}
          />
          <div className="hosp-pe">
            <span className="coord">{formatarCoordenada(lat!, lng!)}</span>
            <a
              href={linkMapa(lat!, lng!, nome)}
              target="_blank"
              rel="noopener noreferrer"
            >
              abrir no mapa
            </a>
            <span className="grow" />
            <button type="button" className="limpar" onClick={() => onPonto(null, null)}>
              tirar o pino
            </button>
          </div>
          <p className="hosp-dica">Clique no mapa ou arraste o pino para ajustar.</p>
        </>
      ) : (
        <p className="check-vazio">
          Busque o endereço acima para marcar no mapa onde vocês vão ficar.
        </p>
      )}
    </div>
  );
}
