import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Identifica quem está chamando, sem guardar o IP.
 *
 * O hash serve para contar tentativas do mesmo lugar; o endereço em si nunca
 * chega ao banco. Se alguém abrir a tabela, vê contagens, não pessoas.
 */
export function clientKey(req: Request, escopo: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "desconhecido";
  const hash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  return `${escopo}:${hash}`;
}

/**
 * Janela deslizante simples: conta as tentativas dos últimos `janelaMin`
 * minutos e registra mais uma. Retorna `ok: false` quando estourou.
 *
 * Não é à prova de corrida — duas requisições simultâneas podem passar juntas
 * na última vaga. Para o que isto protege (impedir que um script crie contas
 * em massa) a folga de uma não muda nada, e evitar a corrida exigiria uma
 * transação serializável a cada chamada.
 */
export async function rateLimit(
  key: string,
  limite: number,
  janelaMin: number,
): Promise<{ ok: boolean; restantes: number }> {
  const desde = new Date(Date.now() - janelaMin * 60_000);

  const usados = await prisma.rateHit.count({
    where: { key, createdAt: { gte: desde } },
  });

  if (usados >= limite) return { ok: false, restantes: 0 };

  await prisma.rateHit.create({ data: { key } });

  // Faxina oportunista: em vez de um cron só para isto, uma chamada em cada
  // cinquenta apaga o que já passou de um dia. A tabela nunca cresce sem fim
  // e o custo fica diluído.
  if (Math.random() < 0.02) {
    const ontem = new Date(Date.now() - 24 * 60 * 60_000);
    await prisma.rateHit
      .deleteMany({ where: { createdAt: { lt: ontem } } })
      .catch(() => {
        /* faxina é acessório: se falhar, a requisição segue normal */
      });
  }

  return { ok: true, restantes: limite - usados - 1 };
}
