import { PrismaClient, TripStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const YEAR = new Date().getFullYear();

async function main() {
  const email = "demo@cotrip.app";
  const passwordHash = await bcrypt.hash("demo1234", 10);

  // Usuário demo (idempotente)
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Viajante Demo", passwordHash },
  });

  // Quadro demo — evita duplicar em re-seeds
  const existing = await prisma.board.findFirst({
    where: { name: "Nossas Viagens", members: { some: { userId: user.id } } },
  });
  if (existing) {
    console.log("Seed já aplicado. Login demo: demo@cotrip.app / demo1234");
    return;
  }

  const board = await prisma.board.create({
    data: {
      name: "Nossas Viagens",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const trips: Array<{
    dest: string;
    whenText: string;
    year: number;
    status: TripStatus;
    budget: number | null;
    note: string;
  }> = [
    { dest: "Fernando de Noronha", whenText: "Novembro", year: YEAR, status: "RESERVADO", budget: 4200, note: "Mergulho na Baía do Sancho, trilha do Atalaia. Passagem já emitida." },
    { dest: "Jericoacoara", whenText: "Setembro", year: YEAR, status: "PLANEJANDO", budget: 1500, note: "Buggy nas dunas, pôr do sol na Duna do Pôr do Sol, rede no mar." },
    { dest: "Buenos Aires", whenText: "Abril", year: YEAR + 1, status: "IDEIA", budget: 3500, note: "Tango em San Telmo, parrilla, feira de Recoleta." },
    { dest: "Chapada Diamantina", whenText: "Julho", year: YEAR + 1, status: "IDEIA", budget: 2200, note: "Cachoeira da Fumaça, Poço Azul, Vale do Pati." },
    { dest: "Lisboa & Porto", whenText: "Maio", year: YEAR + 2, status: "IDEIA", budget: 9000, note: "Duas semanas, comboio entre as cidades, Sintra num bate-volta." },
    { dest: "Japão", whenText: "Temporada das cerejeiras", year: 0, status: "IDEIA", budget: 15000, note: "O sonho antigo. Tóquio, Kyoto, talvez Osaka." },
  ];

  for (const t of trips) {
    await prisma.trip.create({ data: { ...t, boardId: board.id } });
  }

  console.log("Seed pronto! Login demo: demo@cotrip.app / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
