-- Datas exatas de ida e volta. Ambas opcionais: viagem que ainda é ideia
-- continua vivendo só com "época" em texto livre e ano.
ALTER TABLE "Trip" ADD COLUMN "startDate" DATE;
ALTER TABLE "Trip" ADD COLUMN "endDate" DATE;
