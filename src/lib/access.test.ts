import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { getItemAccess, getMembership, getTripAccess, isOwner } from "./access";

/* ============================================================
   Isolamento entre quadros — o teste que realmente importa

   Monta duas pessoas com um quadro cada e verifica que nenhuma alcança o
   conteúdo da outra. Precisa de banco de verdade: é justamente a consulta ao
   banco que está sendo verificada, e simular o Prisma testaria o dublê em
   vez da regra.

   Roda contra o DATABASE_URL do ambiente (o branch de dev do Neon). Cria
   tudo com prefixo próprio e apaga no fim.
   ============================================================ */

const prisma = new PrismaClient();
const MARCA = `teste-acesso-${Date.now()}`;

let ana = "";
let bruno = "";
let quadroDaAna = "";
let viagemDaAna = "";
let itemDaAna = "";

before(async () => {
  const a = await prisma.user.create({
    data: { email: `ana-${MARCA}@teste.local`, name: "Ana", passwordHash: "x" },
  });
  const b = await prisma.user.create({
    data: { email: `bruno-${MARCA}@teste.local`, name: "Bruno", passwordHash: "x" },
  });
  ana = a.id;
  bruno = b.id;

  const quadro = await prisma.board.create({
    data: {
      name: `Quadro da Ana ${MARCA}`,
      members: { create: { userId: ana, role: "OWNER" } },
      trips: { create: { dest: "Noronha", budgetCents: 420000 } },
    },
    include: { trips: true },
  });
  quadroDaAna = quadro.id;
  viagemDaAna = quadro.trips[0]!.id;

  const item = await prisma.checklistItem.create({
    data: { tripId: viagemDaAna, label: "Passagem", amountCents: 218000 },
  });
  itemDaAna = item.id;
});

after(async () => {
  await prisma.board.deleteMany({ where: { name: { contains: MARCA } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  await prisma.$disconnect();
});

describe("getMembership", () => {
  it("encontra o vínculo de quem é membro", async () => {
    const m = await getMembership(quadroDaAna, ana);
    assert.ok(m);
    assert.equal(m.role, "OWNER");
  });

  it("não encontra nada para quem está de fora", async () => {
    assert.equal(await getMembership(quadroDaAna, bruno), null);
  });
});

describe("getTripAccess", () => {
  it("o dono alcança a própria viagem", async () => {
    const r = await getTripAccess(viagemDaAna, ana);
    assert.ok(r);
    assert.equal(r.trip.dest, "Noronha");
  });

  it("um estranho NÃO alcança a viagem", async () => {
    assert.equal(await getTripAccess(viagemDaAna, bruno), null);
  });

  it("viagem inexistente devolve o mesmo null que viagem alheia", async () => {
    // a indistinguibilidade é intencional: quem chama responde 404 nos dois
    // casos, então um id válido de outro quadro não se revela pela resposta
    assert.equal(await getTripAccess("cmnaoexiste000000000000", ana), null);
    assert.equal(await getTripAccess(viagemDaAna, bruno), null);
  });
});

describe("getItemAccess", () => {
  it("o dono alcança o item do próprio checklist", async () => {
    const r = await getItemAccess(itemDaAna, ana);
    assert.ok(r);
    assert.equal(r.item.label, "Passagem");
  });

  it("um estranho NÃO alcança o item", async () => {
    // caminho mais longo: item -> viagem -> quadro. É onde um descuido
    // passaria despercebido, porque o item não guarda o quadro diretamente
    assert.equal(await getItemAccess(itemDaAna, bruno), null);
  });
});

describe("isOwner", () => {
  it("só OWNER é dono", () => {
    assert.equal(isOwner("OWNER"), true);
    assert.equal(isOwner("EDITOR"), false);
    assert.equal(isOwner(null), false);
    assert.equal(isOwner(undefined), false);
  });
});
