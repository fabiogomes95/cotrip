import type { Status } from "@/lib/status";

export type Role = "OWNER" | "EDITOR";

export interface TripDTO {
  id: string;
  boardId: string;
  dest: string;
  whenText: string;
  year: number;
  status: Status;
  budget: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
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
