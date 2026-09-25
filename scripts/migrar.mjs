#!/usr/bin/env node
/**
 * Migração de banco em um comando só.
 *
 * Existe porque o passo esquecível não é a migração — é o que vem depois:
 * o servidor de desenvolvimento já está rodando com o Prisma Client ANTIGO
 * carregado na memória. O Node não recarrega módulo de node_modules, e o
 * `prisma.ts` ainda guarda a instância no globalThis, então nem o hot reload
 * do Next resolve. O sintoma é sempre o mesmo: "Unknown field `x`" numa
 * coluna que existe no banco.
 *
 * Uso:  npm run db:migrate -- nome_da_migracao
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const nome = process.argv[2];
const rodar = (cmd) => execSync(cmd, { stdio: "inherit" });

if (!nome) {
  console.error("Falta o nome da migração:  npm run db:migrate -- nome_aqui");
  process.exit(1);
}

console.log("\n1/3  Aplicando a migração…");
// --create-only + deploy em vez de `migrate dev`: o `dev` é interativo e
// trava quando roda sem terminal (agente, CI).
rodar(`npx prisma migrate dev --name ${nome} --skip-generate --create-only`);
rodar("npx prisma migrate deploy");

console.log("\n2/3  Regenerando o Prisma Client…");
rodar("npx prisma generate");

console.log("\n3/3  Servidor de desenvolvimento");
let rodando = false;
try {
  const saida = execSync("pgrep -af 'next dev|next-server' || true", { encoding: "utf8" });
  rodando = saida.trim().length > 0;
} catch {
  /* pgrep sem resultado sai com código 1; tratado acima com o `|| true` */
}

if (rodando) {
  console.log("     Derrubando o servidor — ele está com o cliente antigo na memória.");
  try {
    execSync("pkill -f 'next dev|next-server'");
  } catch {
    /* já morreu entre o pgrep e o pkill */
  }
  console.log("     Suba de novo com:  npm run dev");
} else {
  console.log("     Não está rodando. Nada a fazer.");
}

// Aviso final se o schema declara algo que a migração não criou.
if (existsSync("prisma/schema.prisma")) {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelos = [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]);
  console.log(`\nPronto. ${modelos.length} modelos no schema.\n`);
}
