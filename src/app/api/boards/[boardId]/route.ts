import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getMembership, isOwner } from "@/lib/auth-helpers";
import { boardUpdateSchema } from "@/lib/validation";
import { toTripDTO, tripInclude } from "@/lib/trip-dto";

type Params = { params: Promise<{ boardId: string }> };

// GET /api/boards/:id — detalhe do quadro + viagens + membros.
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });

  const [board, trips, members] = await Promise.all([
    prisma.board.findUnique({ where: { id: boardId } }),
    prisma.trip.findMany({
      where: { boardId },
      orderBy: { createdAt: "asc" },
      include: tripInclude,
    }),
    prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!board) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });

  return NextResponse.json({
    board: { id: board.id, name: board.name },
    role: membership.role,
    trips: trips.map(toTripDTO),
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  });
}

// PATCH /api/boards/:id — renomeia (somente OWNER).
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });
  if (!isOwner(membership.role))
    return NextResponse.json({ error: "Apenas o dono pode renomear" }, { status: 403 });

  const parsed = boardUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const board = await prisma.board.update({
    where: { id: boardId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ id: board.id, name: board.name });
}

// DELETE /api/boards/:id — apaga o quadro (somente OWNER).
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });
  if (!isOwner(membership.role))
    return NextResponse.json({ error: "Apenas o dono pode excluir o quadro" }, { status: 403 });

  await prisma.board.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true });
}
