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
  budget: z
    .union([z.coerce.number().int().min(0).max(100_000_000), z.null()])
    .optional()
    .default(null),
  note: z.string().trim().max(2000).optional().default(""),
});

export const tripUpdateSchema = tripCreateSchema.partial();

export type TripInput = z.infer<typeof tripCreateSchema>;
