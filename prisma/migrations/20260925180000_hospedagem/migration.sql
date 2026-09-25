-- Onde a pessoa se hospeda, para o mapa da viagem.
ALTER TABLE "Trip" ADD COLUMN "stayName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Trip" ADD COLUMN "stayAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Trip" ADD COLUMN "stayLat" DOUBLE PRECISION;
ALTER TABLE "Trip" ADD COLUMN "stayLng" DOUBLE PRECISION;
