import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getPreTaskAccess } from "@/lib/auth-helpers";
import { preTaskUpdateSchema } from "@/lib/validation";
import { toPreTaskDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ taskId: string }> };

// PATCH /api/tasks/:id — marca, renomeia, muda o responsável ou o momento.
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { taskId } = await params;
  const access = await getPreTaskAccess(taskId, user.id);
  if (!access) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const parsed = preTaskUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const task = await prisma.preTripTask.update({
    where: { id: taskId },
    data: parsed.data,
  });
  return NextResponse.json({ task: toPreTaskDTO(task) });
}

// DELETE /api/tasks/:id
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { taskId } = await params;
  const access = await getPreTaskAccess(taskId, user.id);
  if (!access) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  await prisma.preTripTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
