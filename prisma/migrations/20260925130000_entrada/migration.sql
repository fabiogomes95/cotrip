-- Entrada no parcelamento: o pedaço pago na hora da compra.
--
-- Os defaults preservam o que já existe: sem entrada e não paga, que é
-- exatamente o comportamento anterior. Nenhum item muda de valor.
ALTER TABLE "ChecklistItem" ADD COLUMN "downPaymentCents" INTEGER;
ALTER TABLE "ChecklistItem" ADD COLUMN "downPaymentPaid" BOOLEAN NOT NULL DEFAULT false;
