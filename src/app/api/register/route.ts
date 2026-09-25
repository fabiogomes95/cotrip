import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // 5 cadastros por hora por IP. Alto o bastante para uma família inteira
  // criando conta junto, baixo o bastante para matar script de criação em massa.
  const limite = await rateLimit(clientKey(req, "register"), 5, 60);
  if (!limite.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas de cadastro. Tente de novo daqui a pouco." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const { name, email, password, inviteToken } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma conta com esse email" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name, email, passwordHash },
    });

    // Cria um quadro pessoal por padrão.
    await tx.board.create({
      data: {
        name: "Minhas Viagens",
        members: { create: { userId: created.id, role: "OWNER" } },
      },
    });

    // Aceita convites pendentes para este email (por token específico ou por email).
    const pending = await tx.invitation.findMany({
      where: {
        email,
        acceptedAt: null,
        ...(inviteToken ? { token: inviteToken } : {}),
      },
    });

    for (const inv of pending) {
      // Evita duplicar membership caso já exista.
      const already = await tx.boardMember.findUnique({
        where: { boardId_userId: { boardId: inv.boardId, userId: created.id } },
      });
      if (!already) {
        await tx.boardMember.create({
          data: { boardId: inv.boardId, userId: created.id, role: inv.role },
        });
      }
      await tx.invitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date() },
      });
    }

    return created;
  });

  return NextResponse.json(
    { id: user.id, email: user.email, name: user.name },
    { status: 201 },
  );
}
