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
