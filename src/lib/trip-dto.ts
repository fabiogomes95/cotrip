import type { ChecklistItem, Trip } from "@prisma/client";
import type { ChecklistItemDTO, TripDTO } from "@/types";
import type { Status } from "@/lib/status";

/**
 * Include padrão de toda leitura de viagem. Fica aqui para que a página do
 * servidor e as rotas da API não saiam de sincronia — se um lado esquecer os
 * itens, o checklist some sem erro nenhum, que é o tipo de bug chato de achar.
 */
export const tripInclude = {
  items: { orderBy: { position: "asc" } },
} satisfies { items: { orderBy: { position: "asc" } } };

type TripWithItems = Trip & { items: ChecklistItem[] };

export function toItemDTO(i: ChecklistItem): ChecklistItemDTO {
  return {
    id: i.id,
    tripId: i.tripId,
    label: i.label,
    done: i.done,
    amount: i.amount,
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
    status: t.status as Status,
    budget: t.budget,
    note: t.note,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    items: t.items.map(toItemDTO),
  };
}
