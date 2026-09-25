import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Newsreader } from "next/font/google";
import "./globals.css";

/* As três fontes são hospedadas junto com o app, não buscadas no Google a
   cada visita. O next/font baixa os arquivos no build, serve do mesmo
   domínio e já embute o @font-face com métricas de fallback — o que elimina
   a ida a dois servidores externos (fonts.googleapis + fonts.gstatic) antes
   do primeiro texto aparecer, e o pulo de layout quando a fonte chega.

   Sem `weight`: as três são fontes variáveis, então vem a faixa inteira de
   pesos num arquivo só. O app usa de 400 a 800. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--f-display",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--f-body",
  display: "swap",
});

// A serifada só aparece em itálico (as frases de apoio), então é só o que baixa.
const serif = Newsreader({
  subsets: ["latin"],
  style: "italic",
  variable: "--f-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CoTrip — planejem viagens juntos",
  description:
    "Do 'um dia a gente vai' à viagem reservada. Um quadro compartilhado para planejar viagens em grupo, com status, orçamento e prazos.",
};

export const viewport: Viewport = {
  themeColor: "#0f857a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} ${serif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
