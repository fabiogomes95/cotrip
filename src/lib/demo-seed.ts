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
/* Um segundo quadro, este compartilhado, para a demo mostrar os dois modos:
   o espaço solo e o dividido com alguém — inclusive o acerto de contas, que
   só existe quando tem mais de uma pessoa. */
export const DEMO_QUADRO_2 = "Chile com a Duda";
const DUDA_EMAIL = "duda@cotrip.app";

const ANO = () => new Date().getFullYear();

type ViagemDemo = {
  dest: string;
  whenText: string;
  ano: number;
  /** Datas exatas, quando a demo quer mostrar a contagem regressiva. */
  ida?: [number, number, number];
  volta?: [number, number, number];
  status: TripStatus;
  budgetCents: number | null;
  people?: number;
  /** Hospedagem, para a demo mostrar o mapa. */
  hosp?: { nome: string; endereco: string; lat: number; lng: number };
  note: string;
  /** Passeios com contato, para a demo mostrar o módulo do destino. */
  passeios?: Array<{ label: string; contact?: string; timeText?: string; status: "IDEIA" | "AGENDADO" | "FEITO" }>;
  /** Gastos avulsos do dia a dia. */
  gastos?: Array<{ label: string; category: "TRANSPORTE" | "ALIMENTACAO" | "PASSEIO" | "COMPRAS" | "OUTROS"; totalCents: number }>;
  /** Tarefas de antes de sair, para a demo mostrar o módulo. */
  tarefas?: Array<{ label: string; done: boolean; assignee?: string; when: "ANTES" | "VESPERA" | "SAIDA" }>;
  items?: Array<{
    label: string;
    done: boolean;
    amountCents: number | null;
    downPaymentCents?: number;
    downPaymentPaid?: boolean;
    installments?: number;
    paidInstallments?: number;
    /** [ano, mês 0-based, dia] */
    firstDueDate?: [number, number, number];
  }>;
};

/** Valores em CENTAVOS — o `_00` no fim deixa a unidade visível de relance. */
function viagens(): ViagemDemo[] {
  const Y = ANO();
  return [
    {
      dest: "Fernando de Noronha", whenText: "Novembro", ano: Y, status: "RESERVADO",
      // Com data: o cartão ganha "faltam N dias" e a duração em noites.
      ida: [Y, 10, 12], volta: [Y, 10, 19],
      budgetCents: 4200_00, people: 2,
      hosp: {
        nome: "Pousada Maravilha",
        endereco: "Baía do Sueste, Fernando de Noronha — PE",
        lat: -3.86694, lng: -32.42806,
      },
      note: `## Antes de ir

- Passagem emitida, **entrada paga** e o resto em 6x
- Taxa de preservação e do parque já quitadas
- Falta fechar o **mergulho batismo**

## O que não pode faltar

- [x] Baía do Sancho no fim da tarde
- [ ] Trilha do Atalaia (agendar com antecedência)
- [ ] Pôr do sol no Boldró

> A trilha do Atalaia tem vaga limitada por dia — dá para agendar no ICMBio
> assim que a passagem sai.`,
      passeios: [
        { label: "Passeio de barco pela ilha", contact: "Zé do Barco · (81) 98888-1234", timeText: "9h", status: "AGENDADO" },
        { label: "Mergulho batismo", contact: "Atlantis Divers · (81) 99777-4321", timeText: "manhã", status: "IDEIA" },
        { label: "Trilha do Atalaia", contact: "ICMBio — agendar no site", timeText: "fim da tarde", status: "IDEIA" },
      ],
      // Muitos gastos pequenos de transporte: é o caso que o módulo existe
      // para tornar visível.
      gastos: [
        { label: "Táxi do aeroporto", category: "TRANSPORTE", totalCents: 9000 },
        { label: "Buggy até a Baía dos Porcos", category: "TRANSPORTE", totalCents: 12000 },
        { label: "Corrida até o Sancho", category: "TRANSPORTE", totalCents: 4500 },
        { label: "Almoço no Porto", category: "ALIMENTACAO", totalCents: 18000 },
        { label: "Jantar na Vila", category: "ALIMENTACAO", totalCents: 22000 },
        { label: "Lembrancinhas", category: "COMPRAS", totalCents: 8000 },
      ],
      tarefas: [
        { label: "Combinar quem cuida dos gatos", done: true, assignee: "Duda", when: "ANTES" },
        { label: "Levar o Duque para a casa da mãe", done: false, assignee: "Duda", when: "VESPERA" },
        { label: "Deixar ração e areia suficientes", done: true, when: "ANTES" },
        { label: "Deixar a chave com a vizinha", done: false, assignee: "Dona Marta", when: "ANTES" },
        { label: "Separar documentos e carregadores", done: false, when: "VESPERA" },
        { label: "Fechar o registro de água", done: false, when: "SAIDA" },
        { label: "Fechar o gás", done: false, when: "SAIDA" },
        { label: "Tirar aparelhos da tomada", done: false, when: "SAIDA" },
      ],
      items: [
        // Entrada + parcelamento: R$ 500 na hora e o resto em 6x de R$ 280.
        {
          label: "Passagem aérea", done: true, amountCents: 2180_00,
          downPaymentCents: 500_00, downPaymentPaid: true,
          installments: 6, paidInstallments: 2,
          firstDueDate: [Y, 7, 10],
        },
        { label: "Pousada (5 noites)", done: true, amountCents: 1650_00 },
        { label: "Taxa de preservação + parque", done: true, amountCents: 520_00 },
        { label: "Mergulho batismo", done: false, amountCents: 380_00 },
        { label: "Aluguel de buggy", done: false, amountCents: null },
      ],
    },
    {
      dest: "Jericoacoara", whenText: "Setembro", ano: Y, status: "PLANEJANDO",
      budgetCents: 1500_00,
      hosp: {
        nome: "Casa do primo",
        endereco: "Rua das Dunas, Jericoacoara — CE",
        lat: -2.79556, lng: -40.51222,
      },
      note: "Buggy nas dunas, pôr do sol na Duna do Pôr do Sol, rede no mar.",
      items: [
        { label: "Passagem + transfer", done: true, amountCents: 740_00 },
        { label: "Pousada", done: false, amountCents: 520_00 },
        { label: "Passeio de buggy", done: false, amountCents: null },
      ],
    },
    {
      dest: "Serra Gaúcha", whenText: "Junho", ano: Y - 1, status: "FEITA",
      ida: [Y - 1, 5, 10], volta: [Y - 1, 5, 14],
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

  const duda = await prisma.user.upsert({
    where: { email: DUDA_EMAIL },
    update: {},
    create: { email: DUDA_EMAIL, name: "Duda", passwordHash },
  });

  const existente = await prisma.board.findFirst({
    where: { name: DEMO_QUADRO, members: { some: { userId: user.id } } },
  });

  if (existente) {
    if (!recriar) return { criou: false };
    // Cascata apaga viagens e itens junto.
    await prisma.board.delete({ where: { id: existente.id } });
  }
  if (recriar) {
    await prisma.board.deleteMany({ where: { name: DEMO_QUADRO_2 } });
  }

  const board = await prisma.board.create({
    data: {
      name: DEMO_QUADRO,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  for (const { items, tarefas, passeios, gastos, hosp, ano, ida, volta, ...v } of viagens()) {
    await prisma.trip.create({
      data: {
        ...v,
        year: ano,
        stayName: hosp?.nome ?? "",
        stayAddress: hosp?.endereco ?? "",
        stayLat: hosp?.lat ?? null,
        stayLng: hosp?.lng ?? null,
        startDate: ida ? new Date(Date.UTC(...ida)) : null,
        endDate: volta ? new Date(Date.UTC(...volta)) : null,
        boardId: board.id,
        items: items
          ? {
              create: items.map(({ firstDueDate, ...i }, position) => ({
                ...i,
                position,
                firstDueDate: firstDueDate
                  ? new Date(Date.UTC(...firstDueDate))
                  : null,
              })),
            }
          : undefined,
        preTasks: tarefas
          ? { create: tarefas.map((t, position) => ({ ...t, position })) }
          : undefined,
        activities: passeios
          ? { create: passeios.map((a, position) => ({ ...a, position })) }
          : undefined,
        expenses: gastos ? { create: gastos } : undefined,
      },
    });
  }

  await semearQuadroCompartilhado(prisma, user.id, duda.id);

  return { criou: true };
}

/**
 * O quadro de duas pessoas. Os pagamentos são desiguais de propósito: a demo
 * precisa mostrar o acerto de contas com alguém devendo a alguém, que é o
 * único estado em que a funcionalidade diz alguma coisa.
 */
async function semearQuadroCompartilhado(
  prisma: PrismaClient,
  demoId: string,
  dudaId: string,
) {
  const ja = await prisma.board.findFirst({ where: { name: DEMO_QUADRO_2 } });
  if (ja) return;

  const Y = new Date().getFullYear();
  const board = await prisma.board.create({
    data: {
      name: DEMO_QUADRO_2,
      members: {
        create: [
          { userId: demoId, role: "OWNER" },
          { userId: dudaId, role: "EDITOR" },
        ],
      },
    },
  });

  await prisma.trip.create({
    data: {
      boardId: board.id,
      dest: "Santiago e Valparaíso",
      whenText: "Julho",
      year: Y + 1,
      startDate: new Date(Date.UTC(Y + 1, 6, 4)),
      endDate: new Date(Date.UTC(Y + 1, 6, 12)),
      status: "PLANEJANDO",
      budgetCents: 5200_00,
      people: 2,
      note: "Vinhedos no Valle de Casablanca, cerros de Valparaíso, neve em Farellones.",
      items: {
        create: [
          // A demo bancou a passagem inteira, em 10x
          {
            label: "Passagem", position: 0, done: true, amountCents: 3100_00,
            installments: 10, paidInstallments: 3,
            firstDueDate: new Date(Date.UTC(Y, 8, 15)), paidById: demoId,
          },
          // A Duda bancou a hospedagem à vista
          {
            label: "Hospedagem", position: 1, done: true, amountCents: 1400_00,
            installments: 1, paidInstallments: 1, paidById: dudaId,
          },
          { label: "Seguro viagem", position: 2, done: true, amountCents: 180_00,
            installments: 1, paidInstallments: 1, paidById: demoId },
          { label: "Passeio aos vinhedos", position: 3, done: false, amountCents: 320_00 },
          { label: "Transporte no local", position: 4, done: false, amountCents: null },
        ],
      },
    },
  });
}
