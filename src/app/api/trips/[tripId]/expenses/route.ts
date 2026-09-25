import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getTripAccess } from "@/lib/auth-helpers";
import { expenseCreateSchema } from "@/lib/validation";
import { toExpenseDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ tripId: string }> };

// GET /api/trips/:id/expenses
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ expenses: expenses.map(toExpenseDTO) });
}

// POST /api/trips/:id/expenses
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const parsed = expenseCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  // Quem pagou precisa ser membro do quadro — mesma trava do checklist.
  if (parsed.data.paidById) {
    const membro = await prisma.boardMember.findUnique({
      where: {
        boardId_userId: { boardId: access.trip.boardId, userId: parsed.data.paidById },
      },
    });
    if (!membro) {
      return NextResponse.json(
        { error: "Essa pessoa não é membro do quadro" },
        { status: 400 },
      );
    }
  }

  const expense = await prisma.expense.create({ data: { ...parsed.data, tripId } });
  return NextResponse.json({ expense: toExpenseDTO(expense) }, { status: 201 });
}
