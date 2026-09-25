import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getTripAccess } from "@/lib/auth-helpers";
import { preTaskCreateSchema } from "@/lib/validation";
import { toPreTaskDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ tripId: string }> };

// GET /api/trips/:id/tasks — tarefas de antes de sair.
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const tasks = await prisma.preTripTask.findMany({
    where: { tripId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ tasks: tasks.map(toPreTaskDTO) });
}

// POST /api/trips/:id/tasks — adiciona uma tarefa ao fim do grupo.
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const parsed = preTaskCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  // Maior position + 1, e não a contagem: apagar uma do meio faria a
  // contagem repetir um número já usado.
  const last = await prisma.preTripTask.findFirst({
    where: { tripId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const task = await prisma.preTripTask.create({
    data: { ...parsed.data, tripId, position: (last?.position ?? -1) + 1 },
  });
  return NextResponse.json({ task: toPreTaskDTO(task) }, { status: 201 });
}
