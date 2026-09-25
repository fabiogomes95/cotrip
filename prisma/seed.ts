import { PrismaClient } from "@prisma/client";
import { DEMO_EMAIL, DEMO_SENHA, semearDemo } from "../src/lib/demo-seed";

// Os dados vivem em src/lib/demo-seed.ts porque a rota de cron que repõe a
// demo em produção usa exatamente os mesmos.
const prisma = new PrismaClient();

async function main() {
  const { criou } = await semearDemo(prisma);
  console.log(
    criou
      ? `Seed pronto! Login demo: ${DEMO_EMAIL} / ${DEMO_SENHA}`
      : `Seed já aplicado. Login demo: ${DEMO_EMAIL} / ${DEMO_SENHA}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
