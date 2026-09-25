"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa da hospedagem.
 *
 * Carregado sob demanda pelo BoardApp: o Leaflet só funciona no navegador
 * (depende de `window` no módulo) e pesa o suficiente para não valer estar
 * no pacote principal de quem nunca abre esta seção.
 */

/**
 * Pino desenhado em CSS, não em imagem.
 *
 * O ícone padrão do Leaflet aponta para arquivos .png por caminho relativo,
 * que quebra com bundler — é o bug clássico do "marcador invisível". Um
 * divIcon some com o problema e ainda deixa o pino na cor do app.
 */
const pino = L.divIcon({
  className: "pino-mapa",
  html: '<span class="corpo"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

/** Recentraliza quando a coordenada muda por fora (busca, colagem). */
function Recentralizar({ lat, lng }: { lat: number; lng: number }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.setView([lat, lng], mapa.getZoom() < 14 ? 16 : mapa.getZoom());
  }, [mapa, lat, lng]);
  return null;
}

/** Clicar no mapa move o pino — o jeito de ajustar o que a busca errou. */
function CliqueMove({ onMover }: { onMover: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMover(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapaHospedagem({
  lat,
  lng,
  editavel = true,
  onMover,
}: {
  lat: number;
  lng: number;
  editavel?: boolean;
  onMover?: (lat: number, lng: number) => void;
}) {
  const centro = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  return (
    <MapContainer
      center={centro}
      zoom={16}
      // Zoom pela roda desligado: rolar a página com o cursor sobre o mapa
      // daria zoom em vez de rolar, que é o comportamento mais irritante de
      // mapa embutido. O zoom fica nos botões + e −.
      scrollWheelZoom={false}
      className="mapa"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Marker
        position={centro}
        icon={pino}
        draggable={editavel}
        eventHandlers={
          editavel && onMover
            ? {
                dragend(e) {
                  const p = (e.target as L.Marker).getLatLng();
                  onMover(p.lat, p.lng);
                },
              }
            : undefined
        }
      />
      <Recentralizar lat={lat} lng={lng} />
      {editavel && onMover && <CliqueMove onMover={onMover} />}
    </MapContainer>
  );
}
