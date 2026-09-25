import { auth } from "@/auth";

/* As regras de acesso ao banco moram em access.ts, sem dependência de sessão,
   para poderem ser testadas sem simular login. Este arquivo continua sendo o
   ponto de import das rotas — elas não precisam saber dessa separação. */
export { getItemAccess, getMembership, getTripAccess, isOwner } from "@/lib/access";

/** Retorna o usuário da sessão ou null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}
