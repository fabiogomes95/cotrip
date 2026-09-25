import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getItemAccess } from "@/lib/auth-helpers";
import { checklistItemUpdateSchema } from "@/lib/validation";
import { toItemDTO } from "@/lib/trip-dto";

type Params = { params: Promise<{ itemId: string }> };

// PATCH /api/items/:id — marca/desmarca, renomeia ou lança o valor real.
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { itemId } = await params;
  const access = await getItemAccess(itemId, user.id);
  if (!access) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  const parsed = checklistItemUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: parsed.data,
  });
  return NextResponse.json({ item: toItemDTO(item) });
}

// DELETE /api/items/:id
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { itemId } = await params;
  const access = await getItemAccess(itemId, user.id);
  if (!access) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  await prisma.checklistItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
