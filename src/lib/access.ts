import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/* ============================================================
   Regras de acesso (só banco)

   Separado de auth-helpers.ts de propósito: aqui não entra nada de sessão
   nem de next-auth, então dá para testar o isolamento entre quadros com um
   banco de verdade e sem simular login.

   A regra do app inteiro cabe numa frase: ninguém lê nem escreve nada de um
   quadro do qual não é membro.
   ============================================================ */

/** Vínculo do usuário com o quadro, ou null se não for membro. */
export async function getMembership(boardId: string, userId: string) {
  return prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
}

export function isOwner(role: Role | undefined | null) {
  return role === "OWNER";
}

/**
 * Acesso a uma viagem: carrega a viagem e confere a associação ao quadro dela.
 *
 * Retorna null nos dois casos (viagem inexistente ou quadro alheio) de
 * propósito — quem chama responde 404 para ambos, então ninguém descobre se
 * um id existe num quadro que não é seu.
 */
export async function getTripAccess(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return null;

  const membership = await getMembership(trip.boardId, userId);
  if (!membership) return null;

  return { trip, membership };
}

/** Mesma ideia, partindo de um item do checklist. */
export async function getItemAccess(itemId: string, userId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) return null;

  const access = await getTripAccess(item.tripId, userId);
  if (!access) return null;

  return { item, ...access };
}
