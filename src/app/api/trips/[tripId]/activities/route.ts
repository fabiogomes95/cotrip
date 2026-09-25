import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getTripAccess } from "@/lib/auth-helpers";
import { activityCreateSchema } from "@/lib/validation";
import { toActivityDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ tripId: string }> };

// GET /api/trips/:id/activities
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const activities = await prisma.activity.findMany({
    where: { tripId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ activities: activities.map(toActivityDTO) });
}

// POST /api/trips/:id/activities
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tripId } = await params;
  const access = await getTripAccess(tripId, user.id);
  if (!access) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

  const parsed = activityCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const last = await prisma.activity.findFirst({
    where: { tripId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const activity = await prisma.activity.create({
    data: { ...parsed.data, tripId, position: (last?.position ?? -1) + 1 },
  });
  return NextResponse.json({ activity: toActivityDTO(activity) }, { status: 201 });
}
