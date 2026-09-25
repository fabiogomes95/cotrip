import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { boardCreateSchema } from "@/lib/validation";

// GET /api/boards — lista os quadros dos quais o usuário é membro.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const memberships = await prisma.boardMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      board: {
        include: { _count: { select: { trips: true, members: true } } },
      },
    },
  });

  const boards = memberships.map((m) => ({
    id: m.board.id,
    name: m.board.name,
    role: m.role,
    tripCount: m.board._count.trips,
    memberCount: m.board._count.members,
  }));

  return NextResponse.json({ boards });
}

// POST /api/boards — cria um novo quadro (o criador vira OWNER).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = boardCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const board = await prisma.board.create({
    data: {
      name: parsed.data.name,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  return NextResponse.json({ id: board.id, name: board.name }, { status: 201 });
}
