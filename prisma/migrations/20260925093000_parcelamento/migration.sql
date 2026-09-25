-- Pagamento parcelado dos itens do checklist.
--
-- Os defaults cobrem o que já existe: todo item passa a ser "1x, nenhuma
-- paga", que é exatamente o comportamento anterior. Nenhum dado muda de
-- significado por causa desta migração.
ALTER TABLE "ChecklistItem" ADD COLUMN "installments" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChecklistItem" ADD COLUMN "paidInstallments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChecklistItem" ADD COLUMN "firstDueDate" DATE;
