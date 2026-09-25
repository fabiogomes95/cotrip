import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BoardSummary, MemberDTO, TripDTO, Role } from "@/types";
import { toTripDTO, tripInclude } from "@/lib/trip-dto";
import { BoardApp } from "./BoardApp";

export const dynamic = "force-dynamic";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Quadros do usuário
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      board: { include: { _count: { select: { trips: true, members: true } } } },
    },
  });

  // Nenhum quadro? (raro — cadastro cria um) cria um pessoal on-the-fly.
  if (memberships.length === 0) {
    const board = await prisma.board.create({
      data: {
        name: "Minhas Viagens",
        members: { create: { userId, role: "OWNER" } },
      },
    });
    redirect(`/app?board=${board.id}`);
  }

  const boards: BoardSummary[] = memberships.map((m) => ({
    id: m.board.id,
    name: m.board.name,
    role: m.role as Role,
    tripCount: m.board._count.trips,
    memberCount: m.board._count.members,
  }));

  const { board: boardParam } = await searchParams;
  const active = boards.find((b) => b.id === boardParam) ?? boards[0];

  const [tripsRaw, membersRaw] = await Promise.all([
    prisma.trip.findMany({
      where: { boardId: active.id },
      orderBy: { createdAt: "asc" },
      include: tripInclude,
    }),
    prisma.boardMember.findMany({
      where: { boardId: active.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const trips: TripDTO[] = tripsRaw.map(toTripDTO);

  const members: MemberDTO[] = membersRaw.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role as Role,
  }));

  return (
    <BoardApp
      currentUser={{ id: userId, name: session.user.name ?? "", email: session.user.email ?? "" }}
      boards={boards}
      activeBoard={{ id: active.id, name: active.name, role: active.role }}
      initialTrips={trips}
      initialMembers={members}
    />
  );
}
