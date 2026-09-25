-- Quem bancou cada item, para o acerto de contas em quadro compartilhado.
--
-- ON DELETE SET NULL: se a pessoa sai do quadro ou apaga a conta, a despesa
-- continua registrada — some apenas a autoria. Com CASCADE, sair do grupo
-- apagaria o histórico financeiro da viagem inteira.
ALTER TABLE "ChecklistItem" ADD COLUMN "paidById" TEXT;

CREATE INDEX "ChecklistItem_paidById_idx" ON "ChecklistItem"("paidById");

ALTER TABLE "ChecklistItem"
  ADD CONSTRAINT "ChecklistItem_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
