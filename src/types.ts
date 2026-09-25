import type { Status } from "@/lib/status";

export type Role = "OWNER" | "EDITOR";

export interface ChecklistItemDTO {
  id: string;
  tripId: string;
  label: string;
  done: boolean;
  /** Valor TOTAL do item, por pessoa, em CENTAVOS. null = ainda não se sabe. */
  amountCents: number | null;
  /** `done` é CONTRATADO; pagamento é o que estes campos descrevem. */
  /** Entrada em CENTAVOS; o restante é que se parcela. null = sem entrada. */
  downPaymentCents: number | null;
  downPaymentPaid: boolean;
  installments: number;
  paidInstallments: number;
  /** Vencimento da primeira parcela, "AAAA-MM-DD". */
  firstDueDate: string | null;
  /** Quem bancou o item, em quadro compartilhado. */
  paidById: string | null;
  position: number;
}

export type PreTripWhen = "ANTES" | "VESPERA" | "SAIDA";

export interface PreTaskDTO {
  id: string;
  tripId: string;
  label: string;
  done: boolean;
  /** Quem ficou responsável. Texto livre: costuma ser gente sem conta no app. */
  assignee: string;
  when: PreTripWhen;
  position: number;
}

export type ActivityStatus = "IDEIA" | "AGENDADO" | "FEITO";

export interface ActivityDTO {
  id: string;
  tripId: string;
  label: string;
  /** Nome e telefone de quem organiza, em texto livre. */
  contact: string;
  whenAt: string | null;
  timeText: string;
  status: ActivityStatus;
  note: string;
  position: number;
}

export type ExpenseCategory =
  | "TRANSPORTE"
  | "ALIMENTACAO"
  | "PASSEIO"
  | "COMPRAS"
  | "OUTROS";

export interface ExpenseDTO {
  id: string;
  tripId: string;
  label: string;
  category: ExpenseCategory;
  /** TOTAL em centavos, não por pessoa — diferente do checklist de gastos. */
  totalCents: number;
  spentOn: string | null;
  paidById: string | null;
  note: string;
}

export interface TripDTO {
  id: string;
  boardId: string;
  dest: string;
  whenText: string;
  year: number;
  /** Datas exatas como "AAAA-MM-DD", ou null enquanto não se sabe. */
  startDate: string | null;
  endDate: string | null;
  status: Status;
  /** Orçamento estimado por pessoa, em CENTAVOS. O real vem dos `items`. */
  budgetCents: number | null;
  /** Quantas pessoas vão. Os valores são por pessoa; o total é valor × people. */
  people: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItemDTO[];
  preTasks: PreTaskDTO[];
  activities: ActivityDTO[];
  expenses: ExpenseDTO[];
}

export interface BoardSummary {
  id: string;
  name: string;
  role: Role;
  tripCount?: number;
  /** 1 = quadro só seu (solo). Mais que isso = compartilhado. */
  memberCount?: number;
}

export interface MemberDTO {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface InviteDTO {
  id: string;
  email: string;
  role: Role;
}
