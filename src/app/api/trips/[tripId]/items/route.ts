import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getTripAccess } from "@/lib/auth-helpers";
import { checklistItemCreateSchema } from "@/lib/validation";
import { toItemDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ tripId: string }> };

// GET /api/trips/:id/items — itens do checklist da viagem.
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const items = await prisma.checklistItem.findMany({
    where: { tripId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ items: items.map(toItemDTO) });
}

// POST /api/trips/:id/items — adiciona um item ao fim da lista.
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const parsed = checklistItemCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  // Posição = fim da fila. Uso o maior position atual + 1 em vez de contar os
  // itens: se alguém apagar um do meio, a contagem repetiria um número.
  const last = await prisma.checklistItem.findFirst({
    where: { tripId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const item = await prisma.checklistItem.create({
    data: { ...parsed.data, tripId, position: (last?.position ?? -1) + 1 },
  });
  return NextResponse.json({ item: toItemDTO(item) }, { status: 201 });
}
