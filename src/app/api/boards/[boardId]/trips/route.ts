import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getMembership } from "@/lib/auth-helpers";
import { tripCreateSchema } from "@/lib/validation";
import { toTripDTO, tripInclude } from "@/lib/trip-dto";

type Params = { params: Promise<{ boardId: string }> };

// GET /api/boards/:id/trips — viagens do quadro (para membros).
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });

  const trips = await prisma.trip.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
    include: tripInclude,
  });
  return NextResponse.json({ trips: trips.map(toTripDTO) });
}

// POST /api/boards/:id/trips — cria viagem.
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });

  const parsed = tripCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const trip = await prisma.trip.create({
    data: { ...parsed.data, boardId },
    include: tripInclude,
  });
  return NextResponse.json({ trip: toTripDTO(trip) }, { status: 201 });
}
