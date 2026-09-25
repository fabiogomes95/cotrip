import type { PrismaClient, TripStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

/* ============================================================
   Dados da conta de demonstração

   Ficam aqui, e não dentro de prisma/seed.ts, porque dois lugares precisam
   deles: o seed local e a rota de cron que repõe a demo em produção todo dia.
   Duplicar a lista faria a demo do site divergir da de desenvolvimento.
   ============================================================ */

export const DEMO_EMAIL = "demo@cotrip.app";
export const DEMO_SENHA = "demo1234";
export const DEMO_QUADRO = "Nossas Viagens";

const ANO = () => new Date().getFullYear();

type ViagemDemo = {
  dest: string;
  whenText: string;
  ano: number;
  status: TripStatus;
  budgetCents: number | null;
  people?: number;
  note: string;
  items?: Array<{ label: string; done: boolean; amountCents: number | null }>;
};

/** Valores em CENTAVOS — o `_00` no fim deixa a unidade visível de relance. */
function viagens(): ViagemDemo[] {
  const Y = ANO();
  return [
    {
      dest: "Fernando de Noronha", whenText: "Novembro", ano: Y, status: "RESERVADO",
      budgetCents: 4200_00, people: 2,
      note: "Mergulho na Baía do Sancho, trilha do Atalaia. Passagem já emitida.",
      items: [
        { label: "Passagem aérea", done: true, amountCents: 2180_00 },
        { label: "Pousada (5 noites)", done: true, amountCents: 1650_00 },
        { label: "Taxa de preservação + parque", done: true, amountCents: 520_00 },
        { label: "Mergulho batismo", done: false, amountCents: 380_00 },
        { label: "Aluguel de buggy", done: false, amountCents: null },
      ],
    },
    {
      dest: "Jericoacoara", whenText: "Setembro", ano: Y, status: "PLANEJANDO",
      budgetCents: 1500_00,
      note: "Buggy nas dunas, pôr do sol na Duna do Pôr do Sol, rede no mar.",
      items: [
        { label: "Passagem + transfer", done: true, amountCents: 740_00 },
        { label: "Pousada", done: false, amountCents: 520_00 },
        { label: "Passeio de buggy", done: false, amountCents: null },
      ],
    },
    {
      dest: "Serra Gaúcha", whenText: "Junho", ano: Y - 1, status: "FEITA",
      budgetCents: 900_00,
      note: "Gramado e Canela, vinícolas no caminho.",
      items: [
        { label: "Passagem", done: true, amountCents: 410_00 },
        { label: "Hospedagem", done: true, amountCents: 380_00 },
        { label: "Vinícolas", done: true, amountCents: 95_00 },
      ],
    },
    { dest: "Buenos Aires", whenText: "Abril", ano: Y + 1, status: "IDEIA", budgetCents: 3500_00, note: "Tango em San Telmo, parrilla, feira de Recoleta." },
    { dest: "Chapada Diamantina", whenText: "Julho", ano: Y + 1, status: "IDEIA", budgetCents: 2200_00, note: "Cachoeira da Fumaça, Poço Azul, Vale do Pati." },
    { dest: "Lisboa & Porto", whenText: "Maio", ano: Y + 2, status: "IDEIA", budgetCents: 9000_00, note: "Duas semanas, comboio entre as cidades, Sintra num bate-volta." },
    { dest: "Japão", whenText: "Temporada das cerejeiras", ano: 0, status: "IDEIA", budgetCents: 15000_00, note: "O sonho antigo. Tóquio, Kyoto, talvez Osaka." },
  ];
}

/**
 * Deixa a demo no estado original.
 *
 * `recriar: true` apaga o quadro antes — é o que a rota de cron usa para
 * desfazer o que os visitantes mexeram durante o dia. Sem isso, a função é
 * idempotente: se o quadro já existe, não faz nada.
 *
 * O usuário demo nunca é apagado, só o quadro: apagá-lo invalidaria as
 * sessões de quem estivesse com a demo aberta naquele momento.
 */
export async function semearDemo(
  prisma: PrismaClient,
  { recriar = false }: { recriar?: boolean } = {},
): Promise<{ criou: boolean }> {
  const passwordHash = await bcrypt.hash(DEMO_SENHA, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Viajante Demo", passwordHash },
  });

  const existente = await prisma.board.findFirst({
    where: { name: DEMO_QUADRO, members: { some: { userId: user.id } } },
  });

  if (existente) {
    if (!recriar) return { criou: false };
    // Cascata apaga viagens e itens junto.
    await prisma.board.delete({ where: { id: existente.id } });
  }

  const board = await prisma.board.create({
    data: {
      name: DEMO_QUADRO,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  for (const { items, ano, ...v } of viagens()) {
    await prisma.trip.create({
      data: {
        ...v,
        year: ano,
        boardId: board.id,
        items: items
          ? { create: items.map((i, position) => ({ ...i, position })) }
          : undefined,
      },
    });
  }

  return { criou: true };
}
