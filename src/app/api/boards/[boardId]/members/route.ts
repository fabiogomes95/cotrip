import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getMembership, isOwner } from "@/lib/auth-helpers";
import { inviteSchema } from "@/lib/validation";

type Params = { params: Promise<{ boardId: string }> };

// GET /api/boards/:id/members — membros + convites pendentes.
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });

  const [members, invites] = await Promise.all([
    prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { boardId, acceptedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role })),
  });
}

// POST /api/boards/:id/members — convida por email (somente OWNER).
// Se o email já tem conta, adiciona direto como membro. Senão, cria convite pendente.
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });
  if (!isOwner(membership.role))
    return NextResponse.json({ error: "Apenas o dono pode convidar" }, { status: 403 });

  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const { email, role } = parsed.data;

  const invitee = await prisma.user.findUnique({ where: { email } });

  if (invitee) {
    const already = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: invitee.id } },
    });
    if (already) {
      return NextResponse.json({ error: "Essa pessoa já é membro" }, { status: 409 });
    }
    await prisma.boardMember.create({
      data: { boardId, userId: invitee.id, role },
    });
    return NextResponse.json({ status: "added", email }, { status: 201 });
  }

  // Sem conta ainda: registra/atualiza convite pendente.
  const existingInvite = await prisma.invitation.findFirst({
    where: { boardId, email, acceptedAt: null },
  });
  if (existingInvite) {
    return NextResponse.json({ status: "invited", email }, { status: 200 });
  }
  await prisma.invitation.create({ data: { boardId, email, role } });
  return NextResponse.json({ status: "invited", email }, { status: 201 });
}

// DELETE /api/boards/:id/members?userId=... — remove membro (somente OWNER).
export async function DELETE(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { boardId } = await params;
  const membership = await getMembership(boardId, user.id);
  if (!membership) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404 });

  const targetId = new URL(req.url).searchParams.get("userId");
  if (!targetId) return NextResponse.json({ error: "userId ausente" }, { status: 400 });

  const alvo = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: targetId } },
  });
  if (!alvo) return NextResponse.json({ error: "Essa pessoa não é membro" }, { status: 404 });

  /* Dois casos diferentes compartilham esta rota:

     - SAIR: qualquer membro pode ir embora sozinho, sem depender do dono.
       Não precisa ser dono para isso — o contrário prenderia a pessoa num
       quadro do qual ela foi convidada.
     - REMOVER outra pessoa: só o dono, e nunca outro dono. */
  const saindo = targetId === user.id;

  if (saindo) {
    if (isOwner(membership.role)) {
      return NextResponse.json(
        {
          error:
            "O dono não pode sair. Exclua o quadro ou passe a propriedade antes.",
        },
        { status: 400 },
      );
    }
  } else {
    if (!isOwner(membership.role)) {
      return NextResponse.json(
        { error: "Apenas o dono pode remover membros" },
        { status: 403 },
      );
    }
    // Sem esta trava, dois donos podiam se remover um ao outro — e quem
    // clicasse primeiro ficava com o quadro, tirando o acesso de quem o criou.
    if (isOwner(alvo.role)) {
      return NextResponse.json(
        { error: "Não dá para remover outro dono do quadro" },
        { status: 403 },
      );
    }
  }

  await prisma.boardMember.delete({ where: { id: alvo.id } });
  return NextResponse.json({ ok: true });
}
