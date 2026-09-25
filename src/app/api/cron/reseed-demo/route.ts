import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { semearDemo } from "@/lib/demo-seed";

/**
 * Repõe a conta de demonstração no estado original.
 *
 * Existe porque a demo é pública e editável: o link está no portfólio, e
 * qualquer visitante pode apagar as viagens. Sem isto, bastava uma pessoa
 * mal-humorada para o próximo recrutador abrir um quadro vazio.
 *
 * Chamada pelo cron da Vercel (ver vercel.json), que manda o CRON_SECRET no
 * cabeçalho Authorization. Sem o segredo configurado a rota se recusa a rodar
 * — melhor a demo ficar desatualizada do que virar um botão público de apagar
 * tudo.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    await semearDemo(prisma, { recriar: true });
    return NextResponse.json({ ok: true, em: new Date().toISOString() });
  } catch (e) {
    console.error("Falha ao repor a demo:", e);
    return NextResponse.json({ error: "Falha ao repor a demo" }, { status: 500 });
  }
}
