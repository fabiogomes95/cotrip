-- Checklist de antes de viajar: casa, pets, logística.

CREATE TYPE "PreTripWhen" AS ENUM ('ANTES', 'VESPERA', 'SAIDA');

CREATE TABLE "PreTripTask" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "assignee" TEXT NOT NULL DEFAULT '',
    "when" "PreTripWhen" NOT NULL DEFAULT 'ANTES',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreTripTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PreTripTask_tripId_idx" ON "PreTripTask"("tripId");

ALTER TABLE "PreTripTask"
  ADD CONSTRAINT "PreTripTask_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
