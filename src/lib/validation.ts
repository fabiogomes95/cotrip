import { z } from "zod";
import { STATUSES } from "./status";

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

export const tripCreateSchema = z.object({
  dest: z.string().trim().min(1, "Informe o destino").max(120),
  whenText: z.string().trim().max(80).optional().default(""),
  // 0 = "algum dia"; senão, um ano plausível
  year: z.coerce
    .number()
    .int()
    .refine((y) => y === 0 || (y >= 2000 && y <= currentYear + 25), "Ano inválido")
    .default(0),
  status: z.enum(STATUSES).default("IDEIA"),
  // z.null() PRECISA vir antes do número: o default null é reparseado pelo
  // union, e z.coerce.number() transformaria esse null em 0 — "sem orçamento"
  // viraria "orçamento de R$ 0", que são coisas diferentes.
  budget: z
    .union([
      z.null(),
      z.coerce
        .number()
        .int()
        .min(0, "O orçamento não pode ser negativo")
        .max(100_000_000),
    ])
    .optional()
    .default(null),
  note: z.string().trim().max(2000).optional().default(""),
});

export const tripUpdateSchema = tripCreateSchema.partial();

// --- Itens do checklist ---
// O amount aqui e o valor REAL gasto, em contraste com o budget da viagem,
// que e a estimativa. Mesma unidade dos dois: reais inteiros, por pessoa.
export const checklistItemCreateSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome ao item").max(80),
  done: z.boolean().optional().default(false),
  // Mesma ordem do budget, pelo mesmo motivo: item sem valor lançado deve
  // ficar null ("ainda não sei"), não 0 ("não custou nada").
  amount: z
    .union([
      z.null(),
      z.coerce
        .number()
        .int()
        .min(0, "O valor não pode ser negativo")
        .max(100_000_000),
    ])
    .optional()
    .default(null),
});

export const checklistItemUpdateSchema = checklistItemCreateSchema.partial();

export type TripInput = z.infer<typeof tripCreateSchema>;
