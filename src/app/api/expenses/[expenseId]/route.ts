import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getExpenseAccess } from "@/lib/auth-helpers";
import { expenseUpdateSchema } from "@/lib/validation";
import { toExpenseDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ expenseId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { expenseId } = await params;
  const access = await getExpenseAccess(expenseId, user.id);
  if (!access) return NextResponse.json({ error: "Gasto não encontrado" }, { status: 404 });

  const parsed = expenseUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

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

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: parsed.data,
  });
  return NextResponse.json({ expense: toExpenseDTO(expense) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { expenseId } = await params;
  const access = await getExpenseAccess(expenseId, user.id);
  if (!access) return NextResponse.json({ error: "Gasto não encontrado" }, { status: 404 });

  await prisma.expense.delete({ where: { id: expenseId } });
  return NextResponse.json({ ok: true });
}
