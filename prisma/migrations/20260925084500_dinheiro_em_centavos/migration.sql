-- Dinheiro passa a ser guardado em centavos.
--
-- Escrita à mão porque o Prisma, ao ver um campo com nome novo, geraria
-- DROP COLUMN + ADD COLUMN — o que apagaria todos os orçamentos e valores já
-- lançados. RENAME preserva os dados; o UPDATE converte a unidade.
--
-- A ordem importa: renomear primeiro, multiplicar depois. Se fosse ao
-- contrário, um erro no meio deixaria a coluna antiga com valores em centavos
-- e nome de reais.

ALTER TABLE "Trip" RENAME COLUMN "budget" TO "budgetCents";
UPDATE "Trip" SET "budgetCents" = "budgetCents" * 100 WHERE "budgetCents" IS NOT NULL;

ALTER TABLE "ChecklistItem" RENAME COLUMN "amount" TO "amountCents";
UPDATE "ChecklistItem" SET "amountCents" = "amountCents" * 100 WHERE "amountCents" IS NOT NULL;
