import { PrismaClient } from "@prisma/client";

// Reaproveita a instância do PrismaClient em dev (evita esgotar conexões
// no hot-reload do Next). Em produção cria uma só.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
