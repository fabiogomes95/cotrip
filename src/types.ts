import type { Status } from "@/lib/status";

export type Role = "OWNER" | "EDITOR";

export interface ChecklistItemDTO {
  id: string;
  tripId: string;
  label: string;
  done: boolean;
  /** Valor real gasto, por pessoa (R$). null = ainda não se sabe. */
  amount: number | null;
  position: number;
}

export interface TripDTO {
  id: string;
  boardId: string;
  dest: string;
  whenText: string;
  year: number;
  status: Status;
  /** Orçamento estimado por pessoa (R$). O real vem da soma dos `items`. */
  budget: number | null;
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
