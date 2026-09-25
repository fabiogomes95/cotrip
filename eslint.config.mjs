import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/* O eslint-config-next 16 já exporta no formato novo (flat) do ESLint 9, então
   não precisa do FlatCompat — que, aliás, é o que quebrava aqui. */
const config = [
  { ignores: [".next/**", "node_modules/**", "prisma/migrations/**"] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
