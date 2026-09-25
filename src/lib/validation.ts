import { z } from "zod";
import { STATUSES } from "./status";
import { paraData } from "./datas";

/**
 * Data de viagem no formato "AAAA-MM-DD".
 *
 * Sai daqui já como Date em UTC, pronta para o Prisma gravar numa coluna
 * DATE — assim nenhuma rota precisa lembrar de converter.
 */
const dataISO = z
  .union([
    z.null(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)"),
  ])
  .optional()
  .default(null)
  .transform((v) => (v ? paraData(v) : null));

/** A volta não pode ser antes da ida. */
function checarDatas(
  v: { startDate?: Date | null; endDate?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "A volta não pode ser antes da ida",
    });
  }
}

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres").max(200),
  inviteToken: z.string().optional(),
});

export const boardCreateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao quadro").max(80),
});

export const boardUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(["OWNER", "EDITOR"]).optional().default("EDITOR"),
});

const currentYear = new Date().getFullYear();

const tripBase = z.object({
  dest: z.string().trim().min(1, "Informe o destino").max(120),
  whenText: z.string().trim().max(80).optional().default(""),
  // 0 = "algum dia"; senão, um ano plausível
  year: z.coerce
    .number()
    .int()
    .refine((y) => y === 0 || (y >= 2000 && y <= currentYear + 25), "Ano inválido")
    .default(0),
  status: z.enum(STATUSES).default("IDEIA"),
  // Em CENTAVOS. z.null() PRECISA vir antes do número: o default null é
  // reparseado pelo union, e z.coerce.number() transformaria esse null em 0 —
  // "sem orçamento" viraria "orçamento de R$ 0", que são coisas diferentes.
  budgetCents: z
    .union([
      z.null(),
      z.coerce
        .number()
        .int()
        .min(0, "O orçamento não pode ser negativo")
        .max(100_000_000_00), // R$ 100 milhões, em centavos
    ])
    .optional()
    .default(null),
  // Sem .default() aqui: quando o cliente não manda, a API preenche com o
  // número de membros do quadro (quadro solo = 1). Um default fixo aqui
  // atropelaria essa regra.
  people: z.coerce.number().int().min(1, "Precisa ser pelo menos 1").max(50).optional(),
  startDate: dataISO,
  endDate: dataISO,
  note: z.string().trim().max(2000).optional().default(""),
});

/* O refinamento das datas é aplicado depois do .partial(), e não antes: em
   zod, .partial() não existe em schema já refinado. Por isso a base fica
   crua e cada variante recebe a checagem. */
export const tripCreateSchema = tripBase.superRefine(checarDatas);
export const tripUpdateSchema = tripBase.partial().superRefine(checarDatas);

// --- Itens do checklist ---
// O amountCents aqui e o valor REAL gasto, em contraste com o budgetCents da
// viagem, que e a estimativa. Mesma unidade nos dois: centavos, por pessoa.
export const checklistItemCreateSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome ao item").max(80),
  done: z.boolean().optional().default(false),
  // Mesma ordem do budgetCents, pelo mesmo motivo: item sem valor lançado
  // deve ficar null ("ainda não sei"), não 0 ("não custou nada").
  amountCents: z
    .union([
      z.null(),
      z.coerce
        .number()
        .int()
        .min(0, "O valor não pode ser negativo")
        .max(100_000_000_00), // idem: centavos
    ])
    .optional()
    .default(null),
  /* Pagamento. Estes três NÃO têm default de propósito: num PATCH parcial,
     um default sobrescreveria o parcelamento já gravado toda vez que alguém
     apenas marcasse o item como contratado. */
  installments: z.coerce
    .number()
    .int()
    .min(1, "No mínimo 1 parcela")
    .max(60, "No máximo 60 parcelas")
    .optional(),
  paidInstallments: z.coerce
    .number()
    .int()
    .min(0, "Não dá para pagar menos que nenhuma")
    .max(60)
    .optional(),
  firstDueDate: dataISO,
});

export const checklistItemUpdateSchema = checklistItemCreateSchema.partial();

export type TripInput = z.infer<typeof tripCreateSchema>;
