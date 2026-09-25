import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActivityAccess, getCurrentUser } from "@/lib/auth-helpers";
import { activityUpdateSchema } from "@/lib/validation";
import { toActivityDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ activityId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { activityId } = await params;
  const access = await getActivityAccess(activityId, user.id);
  if (!access) return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });

  const parsed = activityUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: parsed.data,
  });
  return NextResponse.json({ activity: toActivityDTO(activity) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { activityId } = await params;
  const access = await getActivityAccess(activityId, user.id);
  if (!access) return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });

  await prisma.activity.delete({ where: { id: activityId } });
  return NextResponse.json({ ok: true });
}
