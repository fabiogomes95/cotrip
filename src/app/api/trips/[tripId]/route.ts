import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getTripAccess } from "@/lib/auth-helpers";
import { tripUpdateSchema } from "@/lib/validation";
import { toTripDTO, tripInclude } from "@/lib/trip-dto";

type Params = { params: Promise<{ tripId: string }> };

// PATCH /api/trips/:id — atualiza uma viagem (membro do quadro dela).
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const parsed = tripUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  // Mesma regra da criação: data exata manda no ano. Só recalcula quando a
  // data de ida veio nesta requisição — um PATCH que só muda o status não
  // deve mexer no ano.
  const dados =
    parsed.data.startDate !== undefined
      ? {
          ...parsed.data,
          year: parsed.data.startDate
            ? parsed.data.startDate.getUTCFullYear()
            : parsed.data.year,
        }
      : parsed.data;

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: dados,
    include: tripInclude,
  });
  return NextResponse.json({ trip: toTripDTO(updated) });
}

// DELETE /api/trips/:id — remove uma viagem.
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  await prisma.trip.delete({ where: { id: tripId } });
  return NextResponse.json({ ok: true });
}
