-- Caldera, vapor y recuperación independiente de mieles dulces.
CREATE TYPE "BoilerSource" AS ENUM ('MANUAL', 'SENSOR', 'PLC', 'IMPORT', 'API');
CREATE TYPE "SteamInjectionState" AS ENUM ('SIN_INYECCION', 'INYECTANDO');
CREATE TYPE "PressureUnit" AS ENUM ('PSI', 'KG_CM2');
CREATE TYPE "GasReadingType" AS ENUM ('INITIAL', 'FINAL', 'REFILL', 'CHECK');
CREATE TYPE "BoilerEventType" AS ENUM ('ENCENDIDO', 'APAGADO', 'CIERRE_FORZADO', 'MANTENIMIENTO', 'INCIDENTE', 'RECARGA_GAS', 'VAPOR_INICIADO', 'VAPOR_DETENIDO', 'CAMBIO_PRESION', 'LECTURA_GAS', 'OBSERVACION');
CREATE TYPE "BoilerProcessType" AS ENUM ('COCIMIENTO', 'MOLIENDA', 'FERMENTACION', 'DESTILACION');

CREATE TABLE "BoilerSession" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "startedById" TEXT NOT NULL,
  "endedById" TEXT,
  "stopOperationId" TEXT,
  "closeReason" TEXT,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BoilerSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BoilerEvent" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "sessionId" TEXT,
  "type" "BoilerEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "metadata" JSONB,
  CONSTRAINT "BoilerEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BoilerProcessLink" (
  "id" TEXT NOT NULL,
  "boilerSessionId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "stage" "LotStage" NOT NULL,
  "processType" "BoilerProcessType" NOT NULL,
  "processId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoilerProcessLink_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SteamInjectionInterval" (
  "id" TEXT NOT NULL,
  "startOperationId" TEXT NOT NULL,
  "stopOperationId" TEXT,
  "cookingId" TEXT NOT NULL,
  "boilerSessionId" TEXT NOT NULL,
  "state" "SteamInjectionState" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SteamInjectionInterval_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PressureReading" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "steamIntervalId" TEXT,
  "boilerSessionId" TEXT NOT NULL,
  "originalValue" DECIMAL(12,4) NOT NULL,
  "originalUnit" "PressureUnit" NOT NULL,
  "canonicalPsi" DECIMAL(12,4) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  CONSTRAINT "PressureReading_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GasReading" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "boilerSessionId" TEXT NOT NULL,
  "levelPercent" DECIMAL(6,3) NOT NULL,
  "levelLiters" DECIMAL(12,3) NOT NULL,
  "type" "GasReadingType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  CONSTRAINT "GasReading_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BoilerMaintenance" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT NOT NULL,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT NOT NULL,
  CONSTRAINT "BoilerMaintenance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BoilerIncident" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "sessionId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT NOT NULL,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT NOT NULL,
  CONSTRAINT "BoilerIncident_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SweetHoneyRecovery" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "sourceCookingId" TEXT NOT NULL,
  "destinationTankId" TEXT,
  "liters" DECIMAL(12,3) NOT NULL,
  "brix" DECIMAL(8,3),
  "recoveredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "source" "BoilerSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  CONSTRAINT "SweetHoneyRecovery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoilerSession_operationId_key" ON "BoilerSession"("operationId");
CREATE UNIQUE INDEX "BoilerSession_stopOperationId_key" ON "BoilerSession"("stopOperationId");
CREATE UNIQUE INDEX "BoilerSession_equipment_open_key" ON "BoilerSession"("equipmentId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "BoilerEvent_operationId_key" ON "BoilerEvent"("operationId");
CREATE UNIQUE INDEX "SteamInjectionInterval_startOperationId_key" ON "SteamInjectionInterval"("startOperationId");
CREATE UNIQUE INDEX "SteamInjectionInterval_stopOperationId_key" ON "SteamInjectionInterval"("stopOperationId");
CREATE UNIQUE INDEX "SteamInjectionInterval_cooking_open_key" ON "SteamInjectionInterval"("cookingId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "PressureReading_operationId_key" ON "PressureReading"("operationId");
CREATE UNIQUE INDEX "GasReading_operationId_key" ON "GasReading"("operationId");
CREATE UNIQUE INDEX "BoilerMaintenance_operationId_key" ON "BoilerMaintenance"("operationId");
CREATE UNIQUE INDEX "BoilerIncident_operationId_key" ON "BoilerIncident"("operationId");
CREATE UNIQUE INDEX "SweetHoneyRecovery_operationId_key" ON "SweetHoneyRecovery"("operationId");

CREATE INDEX "BoilerSession_equipmentId_startedAt_idx" ON "BoilerSession"("equipmentId", "startedAt");
CREATE INDEX "BoilerSession_endedAt_idx" ON "BoilerSession"("endedAt");
CREATE INDEX "BoilerEvent_sessionId_occurredAt_idx" ON "BoilerEvent"("sessionId", "occurredAt");
CREATE INDEX "BoilerEvent_type_occurredAt_idx" ON "BoilerEvent"("type", "occurredAt");
CREATE INDEX "BoilerProcessLink_boilerSessionId_startedAt_idx" ON "BoilerProcessLink"("boilerSessionId", "startedAt");
CREATE INDEX "BoilerProcessLink_lotId_stage_startedAt_idx" ON "BoilerProcessLink"("lotId", "stage", "startedAt");
CREATE INDEX "SteamInjectionInterval_cookingId_startedAt_idx" ON "SteamInjectionInterval"("cookingId", "startedAt");
CREATE INDEX "SteamInjectionInterval_boilerSessionId_startedAt_idx" ON "SteamInjectionInterval"("boilerSessionId", "startedAt");
CREATE INDEX "PressureReading_steamIntervalId_occurredAt_idx" ON "PressureReading"("steamIntervalId", "occurredAt");
CREATE INDEX "PressureReading_boilerSessionId_occurredAt_idx" ON "PressureReading"("boilerSessionId", "occurredAt");
CREATE INDEX "GasReading_boilerSessionId_occurredAt_idx" ON "GasReading"("boilerSessionId", "occurredAt");
CREATE INDEX "GasReading_type_occurredAt_idx" ON "GasReading"("type", "occurredAt");
CREATE INDEX "BoilerMaintenance_equipmentId_occurredAt_idx" ON "BoilerMaintenance"("equipmentId", "occurredAt");
CREATE INDEX "BoilerIncident_equipmentId_occurredAt_idx" ON "BoilerIncident"("equipmentId", "occurredAt");
CREATE INDEX "BoilerIncident_sessionId_occurredAt_idx" ON "BoilerIncident"("sessionId", "occurredAt");
CREATE INDEX "SweetHoneyRecovery_lotId_recoveredAt_idx" ON "SweetHoneyRecovery"("lotId", "recoveredAt");
CREATE INDEX "SweetHoneyRecovery_sourceCookingId_recoveredAt_idx" ON "SweetHoneyRecovery"("sourceCookingId", "recoveredAt");

ALTER TABLE "BoilerSession" ADD CONSTRAINT "BoilerSession_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoilerSession" ADD CONSTRAINT "BoilerSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoilerSession" ADD CONSTRAINT "BoilerSession_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoilerEvent" ADD CONSTRAINT "BoilerEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BoilerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoilerEvent" ADD CONSTRAINT "BoilerEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoilerProcessLink" ADD CONSTRAINT "BoilerProcessLink_boilerSessionId_fkey" FOREIGN KEY ("boilerSessionId") REFERENCES "BoilerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoilerProcessLink" ADD CONSTRAINT "BoilerProcessLink_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoilerProcessLink" ADD CONSTRAINT "BoilerProcessLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SteamInjectionInterval" ADD CONSTRAINT "SteamInjectionInterval_cookingId_fkey" FOREIGN KEY ("cookingId") REFERENCES "Cooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamInjectionInterval" ADD CONSTRAINT "SteamInjectionInterval_boilerSessionId_fkey" FOREIGN KEY ("boilerSessionId") REFERENCES "BoilerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamInjectionInterval" ADD CONSTRAINT "SteamInjectionInterval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PressureReading" ADD CONSTRAINT "PressureReading_steamIntervalId_fkey" FOREIGN KEY ("steamIntervalId") REFERENCES "SteamInjectionInterval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PressureReading" ADD CONSTRAINT "PressureReading_boilerSessionId_fkey" FOREIGN KEY ("boilerSessionId") REFERENCES "BoilerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PressureReading" ADD CONSTRAINT "PressureReading_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_boilerSessionId_fkey" FOREIGN KEY ("boilerSessionId") REFERENCES "BoilerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoilerMaintenance" ADD CONSTRAINT "BoilerMaintenance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoilerMaintenance" ADD CONSTRAINT "BoilerMaintenance_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoilerIncident" ADD CONSTRAINT "BoilerIncident_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoilerIncident" ADD CONSTRAINT "BoilerIncident_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BoilerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoilerIncident" ADD CONSTRAINT "BoilerIncident_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SweetHoneyRecovery" ADD CONSTRAINT "SweetHoneyRecovery_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SweetHoneyRecovery" ADD CONSTRAINT "SweetHoneyRecovery_sourceCookingId_fkey" FOREIGN KEY ("sourceCookingId") REFERENCES "Cooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SweetHoneyRecovery" ADD CONSTRAINT "SweetHoneyRecovery_destinationTankId_fkey" FOREIGN KEY ("destinationTankId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SweetHoneyRecovery" ADD CONSTRAINT "SweetHoneyRecovery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BoilerSession" ADD CONSTRAINT "BoilerSession_dates_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
ALTER TABLE "SteamInjectionInterval" ADD CONSTRAINT "SteamInjectionInterval_dates_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_percent_check" CHECK ("levelPercent" >= 0 AND "levelPercent" <= 100);
ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_liters_check" CHECK ("levelLiters" >= 0);
ALTER TABLE "PressureReading" ADD CONSTRAINT "PressureReading_values_check" CHECK ("originalValue" >= 0 AND "canonicalPsi" >= 0);
ALTER TABLE "SweetHoneyRecovery" ADD CONSTRAINT "SweetHoneyRecovery_values_check" CHECK ("liters" > 0 AND ("brix" IS NULL OR "brix" >= 0));
