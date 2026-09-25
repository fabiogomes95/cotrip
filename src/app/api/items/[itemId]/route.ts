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

  /* Parcelas pagas não podem passar do total de parcelas. A checagem é aqui,
     e não no schema, porque um PATCH pode trazer só um dos dois campos — o
     schema sozinho não sabe com que valor o outro vai ficar. */
  const installments = parsed.data.installments ?? access.item.installments;
  const pagas = parsed.data.paidInstallments ?? access.item.paidInstallments;
  const dados = {
    ...parsed.data,
    ...(parsed.data.installments !== undefined ||
    parsed.data.paidInstallments !== undefined
      ? { paidInstallments: Math.min(Math.max(0, pagas), installments) }
      : {}),
  };

  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: dados,
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
