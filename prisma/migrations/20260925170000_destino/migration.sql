-- Logística no destino: passeios (com contato) e gastos avulsos do dia a dia.

CREATE TYPE "ActivityStatus" AS ENUM ('IDEIA', 'AGENDADO', 'FEITO');
CREATE TYPE "ExpenseCategory" AS ENUM ('TRANSPORTE', 'ALIMENTACAO', 'PASSEIO', 'COMPRAS', 'OUTROS');

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "whenAt" DATE,
    "timeText" TEXT NOT NULL DEFAULT '',
    "status" "ActivityStatus" NOT NULL DEFAULT 'IDEIA',
    "note" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Activity_tripId_idx" ON "Activity"("tripId");
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OUTROS',
    "totalCents" INTEGER NOT NULL,
    "spentOn" DATE,
    "paidById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Expense_tripId_idx" ON "Expense"("tripId");
CREATE INDEX "Expense_paidById_idx" ON "Expense"("paidById");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SetNull, como no paidById do checklist: a despesa continua existindo se a
-- pessoa sai do quadro; some só a autoria.
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
