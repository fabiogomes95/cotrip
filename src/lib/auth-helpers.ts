import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/** Retorna o usuário da sessão ou null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

/**
 * Garante que o usuário é membro do quadro. Retorna o membership
 * (com role) ou null se não for membro — a camada de API traduz em 403/404.
 */
export async function getMembership(boardId: string, userId: string) {
  return prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
}

export function isOwner(role: Role | undefined | null) {
  return role === "OWNER";
}

/**
 * Resolve o acesso a uma viagem: carrega a viagem e confere que o usuário é
 * membro do quadro dela. Retorna null nos dois casos (viagem inexistente ou
 * quadro alheio) de propósito — quem chama responde 404 para ambos, então
 * ninguém descobre se um id existe em quadro que não é seu.
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
