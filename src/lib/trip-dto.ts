import type { Activity, ChecklistItem, Expense, PreTripTask, Trip } from "@prisma/client";
import type {
  ActivityDTO,
  ActivityStatus,
  ChecklistItemDTO,
  ExpenseCategory,
  ExpenseDTO,
  PreTaskDTO,
  PreTripWhen,
  TripDTO,
} from "@/types";
import type { Status } from "@/lib/status";
import { paraISO } from "@/lib/datas";

/**
 * Include padrão de toda leitura de viagem. Fica aqui para que a página do
 * servidor e as rotas da API não saiam de sincronia — se um lado esquecer os
 * itens, o checklist some sem erro nenhum, que é o tipo de bug chato de achar.
 */
export const tripInclude = {
  items: { orderBy: { position: "asc" } },
  preTasks: { orderBy: { position: "asc" } },
  activities: { orderBy: { position: "asc" } },
  expenses: { orderBy: { createdAt: "asc" } },
} satisfies {
  items: { orderBy: { position: "asc" } };
  preTasks: { orderBy: { position: "asc" } };
  activities: { orderBy: { position: "asc" } };
  expenses: { orderBy: { createdAt: "asc" } };
};

type TripWithItems = Trip & {
  items: ChecklistItem[];
  preTasks: PreTripTask[];
  activities: Activity[];
  expenses: Expense[];
};

export function toActivityDTO(a: Activity): ActivityDTO {
  return {
    id: a.id,
    tripId: a.tripId,
    label: a.label,
    contact: a.contact,
    whenAt: a.whenAt ? paraISO(a.whenAt) : null,
    timeText: a.timeText,
    status: a.status as ActivityStatus,
    note: a.note,
    position: a.position,
  };
}

export function toExpenseDTO(e: Expense): ExpenseDTO {
  return {
    id: e.id,
    tripId: e.tripId,
    label: e.label,
    category: e.category as ExpenseCategory,
    totalCents: e.totalCents,
    spentOn: e.spentOn ? paraISO(e.spentOn) : null,
    paidById: e.paidById,
    note: e.note,
  };
}

export function toPreTaskDTO(t: PreTripTask): PreTaskDTO {
  return {
    id: t.id,
    tripId: t.tripId,
    label: t.label,
    done: t.done,
    assignee: t.assignee,
    when: t.when as PreTripWhen,
    position: t.position,
  };
}

export function toItemDTO(i: ChecklistItem): ChecklistItemDTO {
  return {
    id: i.id,
    tripId: i.tripId,
    label: i.label,
    done: i.done,
    amountCents: i.amountCents,
    downPaymentCents: i.downPaymentCents,
    downPaymentPaid: i.downPaymentPaid,
    installments: i.installments,
    paidInstallments: i.paidInstallments,
    firstDueDate: i.firstDueDate ? paraISO(i.firstDueDate) : null,
    paidById: i.paidById,
    position: i.position,
  };
}

export function toTripDTO(t: TripWithItems): TripDTO {
  return {
    id: t.id,
    boardId: t.boardId,
    dest: t.dest,
    whenText: t.whenText,
    year: t.year,
    // Sai como "AAAA-MM-DD" e não como Date: o cliente nunca precisa pensar
    // em fuso, e o JSON fica estável.
    startDate: t.startDate ? paraISO(t.startDate) : null,
    endDate: t.endDate ? paraISO(t.endDate) : null,
    status: t.status as Status,
    budgetCents: t.budgetCents,
    people: t.people,
    note: t.note,
    stayName: t.stayName,
    stayAddress: t.stayAddress,
    stayLat: t.stayLat,
    stayLng: t.stayLng,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    items: t.items.map(toItemDTO),
    preTasks: t.preTasks.map(toPreTaskDTO),
    activities: t.activities.map(toActivityDTO),
    expenses: t.expenses.map(toExpenseDTO),
  };
}
