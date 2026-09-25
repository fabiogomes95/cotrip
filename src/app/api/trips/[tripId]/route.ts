import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getMembership } from "@/lib/auth-helpers";
import { tripUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ tripId: string }> };

// PATCH /api/trips/:id — atualiza uma viagem (membro do quadro dela).
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const membership = await getMembership(trip.boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const parsed = tripUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: parsed.data,
  });
  return NextResponse.json({ trip: updated });
}

// DELETE /api/trips/:id — remove uma viagem.
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const membership = await getMembership(trip.boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  await prisma.trip.delete({ where: { id: tripId } });
  return NextResponse.json({ ok: true });
}
