import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/* O eslint-config-next 16 já exporta no formato novo (flat) do ESLint 9, então
   não precisa do FlatCompat — que, aliás, é o que quebrava aqui. */
const config = [
  { ignores: [".next/**", "node_modules/**", "prisma/migrations/**"] },
  ...coreWebVitals,
  ...typescript,
  {
    // Regra escrita para o Pages Router, onde fontes externas tinham que ir
    // no _document.js. Neste projeto (App Router) o <link> no layout raiz É o
    // lugar certo, então o aviso é falso positivo.
    // Melhoria futura: trocar por next/font, que hospeda as fontes junto com
    // o app e elimina a ida ao Google a cada visita.
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-page-custom-font": "off" },
  },
];

export default config;
