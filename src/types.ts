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
