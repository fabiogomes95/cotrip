/* ============================================================
   Datas de viagem

   Regra da casa: data de viagem é DATA, não instante. "12 de novembro" é 12
   de novembro em Fortaleza e em Tóquio. Por isso circula como "AAAA-MM-DD"
   entre servidor e cliente, e toda conta é feita em UTC — nunca no fuso de
   quem está olhando, que mudaria o resultado dependendo de onde a pessoa está.
   ============================================================ */

/** "2026-11-12" → Date na meia-noite UTC daquele dia. */
export function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date → "2026-11-12". */
export function paraISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * O dia de hoje no calendário de quem está olhando, normalizado para UTC.
 *
 * Uso getFullYear/getMonth/getDate (locais) e remonto em UTC: assim "hoje" é
 * o dia que a pessoa vê no relógio dela, mas a subtração acontece entre dois
 * pontos UTC e não escorrega por causa de horário de verão.
 */
export function hojeUTC(agora: Date = new Date()): Date {
  return new Date(
    Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()),
  );
}

const DIA_MS = 86_400_000;

/** Dias inteiros de hoje até a data. Negativo quando já passou. */
export function diasAte(iso: string, agora: Date = new Date()): number {
  return Math.round((paraData(iso).getTime() - hojeUTC(agora).getTime()) / DIA_MS);
}

/** Quantas noites a viagem dura. null se faltar alguma ponta. */
export function noites(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null;
  const n = Math.round((paraData(fim).getTime() - paraData(inicio).getTime()) / DIA_MS);
  return n >= 0 ? n : null;
}

const diaMes = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC", // sem isto o Intl converteria para o fuso local e voltaria um dia
});
const diaMesAno = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function limpa(s: string): string {
  // pt-BR abrevia com ponto: "12 de nov. de 2026". O ponto fica no meio da
  // frase, não no fim, e polui quando vira intervalo. Como estas strings só
  // contêm dia, mês e ano, tirar todos os pontos é seguro.
  return s.replace(/\./g, "");
}

/**
 * Período legível, encurtando o que se repete:
 *   mesmo mês → "12 a 19 de nov de 2026"
 *   mesmo ano → "28 de dez a 3 de jan de 2027"  (não: vira ano diferente)
 *   sem volta → "12 de nov de 2026"
 */
export function formatarPeriodo(
  inicio: string | null,
  fim: string | null,
): string | null {
  if (!inicio) return null;
  const a = paraData(inicio);
  if (!fim || fim === inicio) return limpa(diaMesAno.format(a));

  const b = paraData(fim);
  const mesmoAno = a.getUTCFullYear() === b.getUTCFullYear();
  const mesmoMes = mesmoAno && a.getUTCMonth() === b.getUTCMonth();

  if (mesmoMes) {
    return `${a.getUTCDate()} a ${limpa(diaMesAno.format(b))}`;
  }
  if (mesmoAno) {
    return `${limpa(diaMes.format(a))} a ${limpa(diaMesAno.format(b))}`;
  }
  return `${limpa(diaMesAno.format(a))} a ${limpa(diaMesAno.format(b))}`;
}

/**
 * Soma meses a uma data, respeitando fim de mês.
 *
 * 31 de janeiro + 1 mês não existe em fevereiro. Em vez de escorregar para
 * 3 de março (que é o que a aritmética ingênua de Date faz), gruda no último
 * dia do mês de destino — que é como fatura de cartão se comporta.
 */
export function somarMeses(iso: string, meses: number): string {
  const d = paraData(iso);
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth() + meses;
  const dia = d.getUTCDate();

  // Dia 0 do mês seguinte = último dia do mês alvo.
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return paraISO(new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia))));
}

export type Contagem = {
  txt: string;
  estado: "futuro" | "hoje" | "andamento" | "passado";
};

/**
 * A frase de contagem regressiva do cartão.
 *
 * Trata o intervalo inteiro, não só a ida: uma viagem que começou ontem e
 * termina amanhã não "já passou", está acontecendo.
 */
export function contagem(
  inicio: string | null,
  fim: string | null,
  agora: Date = new Date(),
): Contagem | null {
  if (!inicio) return null;

  const dias = diasAte(inicio, agora);
  if (dias > 1) return { txt: `faltam ${dias} dias`, estado: "futuro" };
  if (dias === 1) return { txt: "é amanhã", estado: "futuro" };
  if (dias === 0) return { txt: "é hoje", estado: "hoje" };

  // Já começou. Ainda está rolando?
  const diasFim = fim ? diasAte(fim, agora) : dias;
  if (diasFim >= 0) return { txt: "em andamento", estado: "andamento" };

  const passados = Math.abs(diasFim);
  if (passados === 1) return { txt: "terminou ontem", estado: "passado" };
  if (passados < 30) return { txt: `há ${passados} dias`, estado: "passado" };
  const meses = Math.round(passados / 30);
  return {
    txt: meses === 1 ? "há 1 mês" : `há ${meses} meses`,
    estado: "passado",
  };
}
