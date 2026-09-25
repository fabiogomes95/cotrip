import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getMembership } from "@/lib/auth-helpers";
import { tripCreateSchema } from "@/lib/validation";
import { toTripDTO, tripInclude } from "@/lib/trip-dto";
import { CHECKLIST_PADRAO } from "@/lib/checklist-defaults";

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

  // Quantas pessoas vão: se o cliente não disser, assume o tamanho do quadro.
  // Num quadro solo dá 1; num quadro de casal, 2. É o palpite certo na
  // esmagadora maioria das vezes, e dá para mudar na própria viagem.
  const membros = await prisma.boardMember.count({ where: { boardId } });
  const people = parsed.data.people ?? Math.max(1, membros);

  // Com data exata, o ano vem dela. Deixar os dois independentes permitiria
  // uma viagem marcada para março de 2027 aparecer na faixa de 2026.
  const year = parsed.data.startDate
    ? parsed.data.startDate.getUTCFullYear()
    : parsed.data.year;

  // Toda viagem nasce com o checklist básico preenchido (sem valores).
  // Em uma transação junto com a viagem: se a criação dos itens falhar,
  // não fica uma viagem pela metade.
  const trip = await prisma.trip.create({
    data: {
      ...parsed.data,
      people,
      year,
      boardId,
      items: {
        create: CHECKLIST_PADRAO.map((label, position) => ({ label, position })),
      },
    },
    include: tripInclude,
  });
  return NextResponse.json({ trip: toTripDTO(trip) }, { status: 201 });
}
