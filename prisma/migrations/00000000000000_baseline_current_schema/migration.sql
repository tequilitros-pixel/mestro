-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RawMaterialMovementType" AS ENUM ('COMPRA', 'PRODUCCION', 'CONSUMO_RECETA', 'AJUSTE', 'MERMA', 'TRASPASO_SUCURSAL');

-- CreateEnum
CREATE TYPE "CashCutStatus" AS ENUM ('ABIERTO', 'CERRADO', 'AUDITADO');

-- CreateEnum
CREATE TYPE "CashCountContext" AS ENUM ('APERTURA', 'CIERRE', 'SIGUIENTE_TURNO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'DIDI', 'UBER', 'RAPPI', 'VALES', 'OTRO');

-- CreateEnum
CREATE TYPE "CashInflowType" AS ENUM ('CAMBIO_RECIBIDO', 'REEMBOLSO', 'AJUSTE', 'PRESTAMO', 'OTRO');

-- CreateEnum
CREATE TYPE "CashEvidenceType" AS ENUM ('DINERO_CONTADO', 'SOBRE', 'TICKET', 'NOTA', 'FACTURA', 'OTRO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'GERENTE', 'ENCARGADO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('HORNO', 'DESGARRADORA', 'PRENSA', 'TINA', 'ALAMBIQUE', 'BOMBA', 'TANQUE', 'CALDERA', 'OTRO');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('DISPONIBLE', 'OPERANDO', 'ESPERANDO', 'LAVADO', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "LotStage" AS ENUM ('RECEPCION', 'COCCION', 'MOLIENDA', 'FERMENTACION', 'DESTILACION', 'RECTIFICACION', 'TERMINADO');

-- CreateEnum
CREATE TYPE "CookingStatus" AS ENUM ('ACTIVA', 'PAUSADA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "CookingEventType" AS ENUM ('INICIO_COCCION', 'INICIO_VAPOR', 'TEMPERATURA', 'MIELES_AMARGAS', 'MIELES_DULCES', 'BAJAR_VAPOR', 'AUMENTAR_VAPOR', 'SUSPENDER_VAPOR', 'FIN_COCCION', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "MillingStatus" AS ENUM ('ACTIVA', 'PAUSADA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "MillingEventType" AS ENUM ('INICIO_MOLIENDA', 'REGISTRO_BRIX', 'REGISTRO_PH', 'REGISTRO_TEMPERATURA', 'AGREGAR_AGUA', 'CAMBIO_PRENSA', 'LAVADO_BAGAZO', 'REGISTRO_BAGAZO', 'FIN_MOLIENDA', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "FermentationStatus" AS ENUM ('ACTIVA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "DistillationStatus" AS ENUM ('ACTIVA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "DistillationType" AS ENUM ('DESTROZADO', 'RECTIFICACION');

-- CreateEnum
CREATE TYPE "DistillationEventType" AS ENUM ('INICIO_CALENTAMIENTO', 'TEMPERATURA', 'ALCOHOL', 'LITROS', 'CORTE_CABEZAS', 'INICIO_CORAZON', 'FIN_CORAZON', 'INICIO_COLAS', 'FIN_DESTILACION', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "LiquorBatchStatus" AS ENUM ('PLANEADO', 'EN_ELABORACION', 'EN_REPOSO', 'LISTO_PARA_EMBOTELLAR', 'TERMINADO', 'CANCELADO', 'PAUSADO', 'EMBOTELLANDO');

-- CreateEnum
CREATE TYPE "LiquorBatchEventType" AS ENUM ('INICIO_ELABORACION', 'INGREDIENTE_AGREGADO', 'MEZCLADO', 'MEDICION', 'CORRECCION', 'FILTRADO', 'INICIO_REPOSO', 'FIN_REPOSO', 'CONTROL_CALIDAD', 'OBSERVACION', 'FIN_ELABORACION');

-- CreateEnum
CREATE TYPE "LiquorQualityStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "LiquorBottlingStatus" AS ENUM ('PLANEADO', 'ACTIVO', 'TERMINADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "LiquorBottleStatus" AS ENUM ('DISPONIBLE', 'RESERVADA', 'VENDIDA', 'MERMA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "LiquorStepType" AS ENUM ('PREPARATION', 'INGREDIENT', 'MIXING', 'WAIT', 'MEASUREMENT', 'QUALITY_CHECK', 'FINISH');

-- CreateEnum
CREATE TYPE "LiquorBatchStepStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'OMITIDO');

-- CreateEnum
CREATE TYPE "LiquorBottleMovementType" AS ENUM ('CREADA', 'RESERVADA', 'LIBERADA', 'TRASPASADA', 'VENDIDA', 'DEVUELTA', 'MERMA', 'RETIRADA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "CashSafeMovementType" AS ENUM ('DEPOSITO_SOBRE', 'RETIRO');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('CONSUMABLE', 'RETURNABLE', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "InventoryHandlingUnit" AS ENUM ('BOTELLA', 'GARRAFA', 'CAJA', 'PAQUETE', 'PIEZA', 'KILOGRAMO', 'LITRO', 'OTRA');

-- CreateEnum
CREATE TYPE "InventoryContentUnit" AS ENUM ('ML', 'L', 'G', 'KG', 'PIEZAS');

-- CreateEnum
CREATE TYPE "PackageItemCalculationType" AS ENUM ('FIXED', 'PER_GUEST', 'PER_GUEST_BLOCK', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventRecountStatus" AS ENUM ('PENDIENTE', 'SURTIDO');

-- CreateEnum
CREATE TYPE "ServiceEventStatus" AS ENUM ('DRAFT', 'PREPARING', 'READY', 'IN_PROGRESS', 'RETURN_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryEntryType" AS ENUM ('COMPRA', 'TRASPASO', 'AJUSTE', 'VENTA_POS', 'DEVOLUCION_POS', 'SALIDA_EVENTO', 'REGRESO_EVENTO', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('BORRADOR', 'CERRADO');

-- CreateEnum
CREATE TYPE "TimeClockSource" AS ENUM ('CHECADOR', 'MANUAL');

-- CreateEnum
CREATE TYPE "TimeClockEditStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ShiftChangeRequestType" AS ENUM ('CANNOT_WORK', 'CHANGE_TIME', 'SWAP', 'DAY_OFF');

-- CreateEnum
CREATE TYPE "ShiftChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('TURNO', 'DESCANSO');

-- CreateEnum
CREATE TYPE "SalarySchemeType" AS ENUM ('HORA', 'DIA', 'SEMANA');

-- CreateEnum
CREATE TYPE "ScheduleWeekStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('AVAILABLE_ALL_DAY', 'AVAILABLE_PARTIAL', 'UNAVAILABLE', 'PREFER_OFF');

-- CreateEnum
CREATE TYPE "AvailabilityReason" AS ENUM ('MEDICAL', 'SCHOOL', 'FAMILY', 'TRAVEL', 'ERRAND', 'OTHER');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONO', 'DEDUCCION');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('BORRADOR', 'REVISION', 'APROBADA', 'PAGADA');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PosDiscountKind" AS ENUM ('DESCUENTO_NORMAL', 'DESCUENTO_EMPLEADO', 'CORTESIA');

-- CreateEnum
CREATE TYPE "PosBenefitReason" AS ENUM ('CLIENTE_FRECUENTE', 'PROMOCION', 'COMPENSACION', 'CONVENIO', 'AUTORIZACION_GERENTE', 'CUMPLEANOS', 'EVENTO', 'INVITADO', 'OTRO');

-- CreateEnum
CREATE TYPE "PosDiscountRuleMode" AS ENUM ('DISCOUNT', 'BLOCK');

-- CreateEnum
CREATE TYPE "NotificationTriggerType" AS ENUM ('STOCK_BAJO', 'LICOR_CADUCIDAD', 'RECONTEO_PENDIENTE', 'CORTE_DIFERENCIA', 'PROCESO_ATRASADO');

-- CreateEnum
CREATE TYPE "EventAddedSourceType" AS ENUM ('COMPRA_EVENTO', 'ENVIO_SUCURSAL', 'ENVIO_ALMACEN', 'PRESTAMO', 'OTRO');

-- CreateEnum
CREATE TYPE "EventAddedStatus" AS ENUM ('ACTIVO', 'CANCELADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "pinHash" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "hourlyRate" DECIMAL(10,2),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "capacity" DOUBLE PRECISION NOT NULL,
    "currentLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage" "LotStage" NOT NULL,
    "agaveKg" DOUBLE PRECISION NOT NULL,
    "art" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "totalLitersObtained" DOUBLE PRECISION,
    "qrToken" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooking" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "agaveKg" DOUBLE PRECISION NOT NULL,
    "status" "CookingStatus" NOT NULL DEFAULT 'ACTIVA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closureCode" TEXT,
    "finalAgaveKg" DOUBLE PRECISION,
    "finalNotes" TEXT,
    "finalSweetHoneyBrix" DOUBLE PRECISION,
    "finalSweetHoneyLiters" DOUBLE PRECISION,
    "finishedById" TEXT,

    CONSTRAINT "Cooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingEvent" (
    "id" TEXT NOT NULL,
    "cookingId" TEXT NOT NULL,
    "type" "CookingEventType" NOT NULL,
    "temperatureTop" DOUBLE PRECISION,
    "temperatureMiddle" DOUBLE PRECISION,
    "temperatureBottom" DOUBLE PRECISION,
    "liters" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milling" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" "MillingStatus" NOT NULL DEFAULT 'ACTIVA',
    "operator" TEXT,
    "cookedKg" DOUBLE PRECISION NOT NULL,
    "waterLiters" DOUBLE PRECISION,
    "mashLiters" DOUBLE PRECISION,
    "bagasseKg" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "pressPasses" INTEGER,
    "washBagasse" BOOLEAN NOT NULL DEFAULT false,
    "washRecoveredLiters" DOUBLE PRECISION,
    "observations" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closureCode" TEXT,
    "finalAverageBrix" DOUBLE PRECISION,
    "finalAveragePh" DOUBLE PRECISION,
    "finalAverageTemp" DOUBLE PRECISION,
    "finalBagasseKg" DOUBLE PRECISION,
    "finalMashLiters" DOUBLE PRECISION,
    "finalNotes" TEXT,
    "finalPressPasses" INTEGER,
    "finalWaterLiters" DOUBLE PRECISION,
    "finishedById" TEXT,

    CONSTRAINT "Milling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillingEvent" (
    "id" TEXT NOT NULL,
    "millingId" TEXT NOT NULL,
    "type" "MillingEventType" NOT NULL,
    "value" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "waterLiters" DOUBLE PRECISION,
    "bagasseKg" DOUBLE PRECISION,
    "washRecoveredLiters" DOUBLE PRECISION,
    "pressPasses" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fermentation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "tank" TEXT NOT NULL,
    "mustLiters" DOUBLE PRECISION NOT NULL,
    "initialBrix" DOUBLE PRECISION NOT NULL,
    "initialPh" DOUBLE PRECISION NOT NULL,
    "initialTemperature" DOUBLE PRECISION NOT NULL,
    "yeast" TEXT,
    "inoculatedAt" TIMESTAMP(3) NOT NULL,
    "status" "FermentationStatus" NOT NULL DEFAULT 'ACTIVA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closureCode" TEXT,
    "finalAlcohol" DOUBLE PRECISION,
    "finalBrix" DOUBLE PRECISION,
    "finalNotes" TEXT,
    "finalPh" DOUBLE PRECISION,
    "finishedById" TEXT,

    CONSTRAINT "Fermentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermentationReading" (
    "id" TEXT NOT NULL,
    "fermentationId" TEXT NOT NULL,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "saccharometer" DOUBLE PRECISION,
    "citricAcidGrams" DOUBLE PRECISION,
    "bicarbonateGrams" DOUBLE PRECISION,
    "heated" BOOLEAN NOT NULL DEFAULT false,
    "heatingMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FermentationReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distillation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "DistillationType" NOT NULL,
    "loadedLiters" DOUBLE PRECISION NOT NULL,
    "initialAlcohol" DOUBLE PRECISION,
    "headsLiters" DOUBLE PRECISION,
    "heartLiters" DOUBLE PRECISION,
    "tailsLiters" DOUBLE PRECISION,
    "finalAlcohol" DOUBLE PRECISION,
    "status" "DistillationStatus" NOT NULL DEFAULT 'ACTIVA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closureCode" TEXT,
    "finalHeadsLiters" DOUBLE PRECISION,
    "finalHeartLiters" DOUBLE PRECISION,
    "finalLiters" DOUBLE PRECISION,
    "finalNotes" TEXT,
    "finalTailsLiters" DOUBLE PRECISION,
    "finishedById" TEXT,

    CONSTRAINT "Distillation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistillationEvent" (
    "id" TEXT NOT NULL,
    "distillationId" TEXT NOT NULL,
    "type" "DistillationEventType" NOT NULL,
    "temperature" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "liters" DOUBLE PRECISION,
    "outputTemperature" DOUBLE PRECISION,
    "alcoholCorrected" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistillationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotExpense" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "LotExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillingDischarge" (
    "id" TEXT NOT NULL,
    "millingId" TEXT NOT NULL,
    "tankId" TEXT,
    "litersRecovered" DOUBLE PRECISION NOT NULL,
    "brix" DOUBLE PRECISION NOT NULL,
    "ph" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MillingDischarge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "baseUnit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageCost" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivesLotOutput" BOOLEAN NOT NULL DEFAULT false,
    "bottleable" BOOLEAN NOT NULL DEFAULT false,
    "bottlePrefix" TEXT,
    "defaultShelfLifeDays" INTEGER,
    "yellowAlertDays" INTEGER,
    "redAlertDays" INTEGER,
    "showExpirationOnLabel" BOOLEAN NOT NULL DEFAULT true,
    "inventoryProductId" TEXT,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterialMovement" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "type" "RawMaterialMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "lotId" TEXT,
    "liquorBatchId" TEXT,
    "branchId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterialMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "defaultAlcohol" DOUBLE PRECISION,
    "defaultShelfLifeDays" INTEGER,
    "yellowAlertDays" INTEGER NOT NULL DEFAULT 30,
    "redAlertDays" INTEGER NOT NULL DEFAULT 7,
    "showExpirationOnLabel" BOOLEAN NOT NULL DEFAULT true,
    "requiresQr" BOOLEAN NOT NULL DEFAULT true,
    "requiresSerialNumber" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inventoryProductId" TEXT,

    CONSTRAINT "LiquorProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorRecipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "targetLiters" DOUBLE PRECISION,
    "targetAlcohol" DOUBLE PRECISION,
    "instructions" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorRecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "LiquorStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT,
    "actions" TEXT[],
    "checks" TEXT[],
    "recipeIngredientId" TEXT,
    "durationMinutes" INTEGER,
    "minimumMinutes" INTEGER,
    "maximumMinutes" INTEGER,
    "measurementLabel" TEXT,
    "measurementUnit" TEXT,
    "minimumValue" DOUBLE PRECISION,
    "maximumValue" DOUBLE PRECISION,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorRecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorRecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawMaterialId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "status" "LiquorBatchStatus" NOT NULL DEFAULT 'PLANEADO',
    "plannedLiters" DOUBLE PRECISION NOT NULL,
    "actualLiters" DOUBLE PRECISION,
    "initialAlcohol" DOUBLE PRECISION,
    "finalAlcohol" DOUBLE PRECISION,
    "productionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),
    "qualityStatus" "LiquorQualityStatus" NOT NULL DEFAULT 'PENDIENTE',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "closureCode" TEXT,
    "observations" TEXT,
    "finalNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "finishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pauseNotes" TEXT,
    "pauseReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pausedById" TEXT,
    "lotId" TEXT,

    CONSTRAINT "LiquorBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBatchEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "LiquorBatchEventType" NOT NULL,
    "temperature" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "liters" DOUBLE PRECISION,
    "ingredientName" TEXT,
    "ingredientQuantity" DOUBLE PRECISION,
    "ingredientUnit" TEXT,
    "qualityStatus" "LiquorQualityStatus",
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquorBatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBatchIngredient" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recipeIngredientId" TEXT,
    "name" TEXT NOT NULL,
    "baseQuantity" DOUBLE PRECISION NOT NULL,
    "scaledQuantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "actualQuantity" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorBatchIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBatchStep" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recipeStepId" TEXT,
    "position" INTEGER NOT NULL,
    "type" "LiquorStepType" NOT NULL,
    "status" "LiquorBatchStepStatus" NOT NULL DEFAULT 'PENDIENTE',
    "title" TEXT NOT NULL,
    "instruction" TEXT,
    "actions" TEXT[],
    "checks" TEXT[],
    "completedActionIndexes" INTEGER[],
    "completedCheckIndexes" INTEGER[],
    "batchIngredientId" TEXT,
    "plannedQuantity" DOUBLE PRECISION,
    "actualQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "durationMinutes" INTEGER,
    "minimumMinutes" INTEGER,
    "maximumMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "measurementLabel" TEXT,
    "measurementUnit" TEXT,
    "minimumValue" DOUBLE PRECISION,
    "maximumValue" DOUBLE PRECISION,
    "measuredValue" DOUBLE PRECISION,
    "validationPassed" BOOLEAN,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorBatchStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBottling" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "batchId" TEXT,
    "rawMaterialId" TEXT,
    "status" "LiquorBottlingStatus" NOT NULL DEFAULT 'PLANEADO',
    "bottleSizeMl" INTEGER NOT NULL,
    "plannedBottles" INTEGER,
    "producedBottles" INTEGER NOT NULL DEFAULT 0,
    "rejectedBottles" INTEGER NOT NULL DEFAULT 0,
    "litersUsed" DOUBLE PRECISION,
    "lossLiters" DOUBLE PRECISION,
    "bottledAt" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "finishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorBottling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBottle" (
    "id" TEXT NOT NULL,
    "bottlingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "qrToken" TEXT NOT NULL,
    "authenticityCode" TEXT,
    "status" "LiquorBottleStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "manufacturedAt" TIMESTAMP(3),
    "bottledAt" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "shelfLifeDays" INTEGER,
    "yellowAlertDays" INTEGER,
    "redAlertDays" INTEGER,
    "showExpirationOnLabel" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "currentLocation" TEXT,
    "reservedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "soldById" TEXT,
    "removedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquorBottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorBottleMovement" (
    "id" TEXT NOT NULL,
    "bottleId" TEXT NOT NULL,
    "type" "LiquorBottleMovementType" NOT NULL,
    "fromBranchId" TEXT,
    "toBranchId" TEXT,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquorBottleMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "geofenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "timeClockId" TEXT,
    "distance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBranch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCut" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "eventId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "status" "CashCutStatus" NOT NULL DEFAULT 'ABIERTO',
    "startingFund" DOUBLE PRECISION NOT NULL,
    "nextFund" DOUBLE PRECISION,
    "cashCounted" DOUBLE PRECISION,
    "cashExpected" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "envelopeAmount" DOUBLE PRECISION,
    "envelopeNumber" TEXT,
    "envelopeNotes" TEXT,
    "totalSales" DOUBLE PRECISION,
    "totalOutflows" DOUBLE PRECISION,
    "totalInflows" DOUBLE PRECISION,
    "totalCostOfGoods" DOUBLE PRECISION,
    "netProfit" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashCut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCutDenomination" (
    "id" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "context" "CashCountContext" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashCutDenomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSalePayment" (
    "id" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashOutflow" (
    "id" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "authorizedById" TEXT,
    "notes" TEXT,
    "receiptPhotoUrl" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashOutflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashInflow" (
    "id" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "type" "CashInflowType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashInflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCutEvidence" (
    "id" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "type" "CashEvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCutEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCutAuditEntry" (
    "id" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCutAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT,
    "codeHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSafeMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "CashSafeMovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cashCutId" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashSafeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "handlingUnit" "InventoryHandlingUnit",
    "contentPerUnit" DECIMAL(12,3),
    "contentUnit" "InventoryContentUnit",
    "normalizedContentPerUnit" DECIMAL(14,3),
    "unitCost" DECIMAL(12,4),
    "minimumStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "itemType" "InventoryItemType" NOT NULL,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "trackBatch" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiration" BOOLEAN NOT NULL DEFAULT false,
    "canBeSold" BOOLEAN NOT NULL DEFAULT false,
    "mustReturn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePerPerson" DECIMAL(10,2),
    "includedHours" INTEGER,
    "minimumGuests" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "calculationType" "PackageItemCalculationType" NOT NULL,
    "guestsPerBlock" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "EventPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEvent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "packageId" TEXT,
    "equipmentKitId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "location" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "saleAmount" DECIMAL(12,2),
    "status" "ServiceEventStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockDeductedAt" TIMESTAMP(3),
    "checkoutConfirmedAt" TIMESTAMP(3),
    "checkoutConfirmedById" TEXT,
    "returnConfirmedAt" TIMESTAMP(3),
    "returnConfirmedById" TEXT,

    CONSTRAINT "ServiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEventItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "unitCost" DECIMAL(12,4),
    "handlingUnit" "InventoryHandlingUnit",
    "contentPerUnit" DECIMAL(12,3),
    "contentUnit" "InventoryContentUnit",
    "returnedOpenQuantity" DECIMAL(12,3),
    "checkoutStatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "returnStatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "checkoutNotes" TEXT,
    "returnNotes" TEXT,
    "plannedQuantity" DECIMAL(12,3) NOT NULL,
    "sentQuantity" DECIMAL(12,3),
    "returnedQuantity" DECIMAL(12,3),
    "damagedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lostQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "checkedOut" BOOLEAN NOT NULL DEFAULT false,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceEventItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRecount" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EventRecountStatus" NOT NULL DEFAULT 'PENDIENTE',
    "fulfilledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRecount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRecountItem" (
    "id" TEXT NOT NULL,
    "recountId" TEXT NOT NULL,
    "eventItemId" TEXT NOT NULL,
    "countedQuantity" DECIMAL(12,3) NOT NULL,
    "missingQuantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "EventRecountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentKit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentKitItem" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EquipmentKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryEntryType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,4),
    "originalQuantity" DECIMAL(12,3),
    "originalUnit" TEXT,
    "handlingUnit" "InventoryHandlingUnit",
    "contentPerUnit" DECIMAL(12,3),
    "contentUnit" "InventoryContentUnit",
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'BORRADOR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountItem" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityCounted" DECIMAL(12,3) NOT NULL,
    "previousQuantity" DECIMAL(12,3),
    "entriesQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(12,3),
    "unitCostAtTime" DECIMAL(12,4),
    "costTotal" DECIMAL(12,2),
    "notes" TEXT,

    CONSTRAINT "InventoryCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModulePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModulePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeClockEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "confirmedByEmployee" BOOLEAN NOT NULL DEFAULT false,
    "closedManuallyById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "TimeClockSource" NOT NULL DEFAULT 'CHECADOR',
    "scheduledShiftId" TEXT,

    CONSTRAINT "TimeClockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeClockEditRequest" (
    "id" TEXT NOT NULL,
    "timeClockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalClockIn" TIMESTAMP(3) NOT NULL,
    "originalClockOut" TIMESTAMP(3),
    "requestedClockIn" TIMESTAMP(3) NOT NULL,
    "requestedClockOut" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "TimeClockEditStatus" NOT NULL DEFAULT 'PENDIENTE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeClockEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ShiftType" NOT NULL DEFAULT 'TURNO',
    "startTime" TEXT,
    "endTime" TEXT,
    "position" TEXT,
    "notes" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityOverrideAudit" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overriddenById" TEXT NOT NULL,
    "availabilitySnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityOverrideAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftChangeRequest" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "type" "ShiftChangeRequestType" NOT NULL,
    "proposedStartTime" TEXT,
    "proposedEndTime" TEXT,
    "swapTargetUserId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ShiftChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheme" "SalarySchemeType" NOT NULL DEFAULT 'HORA',
    "amount" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleWeek" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleWeekStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAvailabilityRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" "AvailabilityReason",
    "reasonNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAvailabilityException" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" "AvailabilityReason",
    "reasonNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "deadlineWeekday" INTEGER NOT NULL DEFAULT 3,
    "deadlineTime" TEXT NOT NULL DEFAULT '18:00',
    "weeksAhead" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchScheduleTemplate" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "branchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTemplateShift" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "userId" TEXT,
    "branchId" TEXT,
    "type" "ShiftType" NOT NULL DEFAULT 'TURNO',
    "startTime" TEXT,
    "endTime" TEXT,
    "position" TEXT,
    "notes" TEXT,

    CONSTRAINT "ScheduleTemplateShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "branchId" TEXT,
    "position" TEXT,
    "instructions" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "overtimeHours" DECIMAL(10,2) NOT NULL,
    "doubleHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tripleHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(10,2),
    "amount" DECIMAL(12,2),
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDIENTE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'BORRADOR',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "rejectedNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "regularHours" DECIMAL(10,2) NOT NULL,
    "overtimeHours" DECIMAL(10,2) NOT NULL,
    "totalHours" DECIMAL(10,2) NOT NULL,
    "basePay" DECIMAL(12,2) NOT NULL,
    "overtimePay" DECIMAL(12,2) NOT NULL,
    "adjustmentsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPay" DECIMAL(12,2) NOT NULL,
    "hoursByDay" JSONB NOT NULL,
    "daysSnapshot" JSONB NOT NULL,
    "adjustmentsSnapshot" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollIncidentJustification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "justifiedById" TEXT NOT NULL,
    "justifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollIncidentJustification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSettings" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "weeklyHourThreshold" DECIMAL(5,2) NOT NULL DEFAULT 48,
    "firstTierHours" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "firstTierMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "secondTierMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PosCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosProduct" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isBottleItem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "employeePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosVariantIngredient" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "inventoryProductId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "PosVariantIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "soldById" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "total" DOUBLE PRECISION NOT NULL,
    "discountKind" "PosDiscountKind",
    "discountReasonCode" "PosBenefitReason",
    "employeeBuyerId" TEXT,
    "authorizedById" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "status" "PosSaleStatus" NOT NULL DEFAULT 'COMPLETADA',
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "variantId" TEXT,
    "name" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "discountKind" "PosDiscountKind",
    "discountReason" "PosBenefitReason",
    "discountReasonNote" TEXT,
    "originalUnitPrice" DOUBLE PRECISION,
    "benefitAmount" DOUBLE PRECISION,
    "beneficiaryEmployeeId" TEXT,
    "authorizedById" TEXT,

    CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PosSalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosDiscountLimit" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "maxPercent" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PosDiscountLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosDiscountRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "PosDiscountRuleMode" NOT NULL DEFAULT 'DISCOUNT',
    "percent" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosDiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "employeeDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "employeeBottleMonthlyLimit" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PosSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "NotificationTriggerType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recipientRoles" "UserRole"[],
    "checkFrequencyMinutes" INTEGER NOT NULL DEFAULT 60,
    "thresholdConfig" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAddedProduct" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT,
    "temporaryName" TEXT,
    "temporaryCategory" TEXT,
    "sourceType" "EventAddedSourceType" NOT NULL,
    "sourceBranchId" TEXT,
    "quantityOriginal" DECIMAL(12,3) NOT NULL,
    "handlingUnit" "InventoryHandlingUnit",
    "contentPerUnit" DECIMAL(12,3),
    "contentUnit" "InventoryContentUnit",
    "normalizedQuantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(12,4),
    "totalCost" DECIMAL(12,2),
    "returnedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "returnedOpenQuantity" DECIMAL(12,3),
    "returnBranchId" TEXT,
    "supplier" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "status" "EventAddedStatus" NOT NULL DEFAULT 'ACTIVO',
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "movementId" TEXT,
    "returnMovementId" TEXT,

    CONSTRAINT "EventAddedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAddedProductLog" (
    "id" TEXT NOT NULL,
    "addedProductId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAddedProductLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BranchToPosDiscountRule" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BranchToPosDiscountRule_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthThrottle_blockedUntil_idx" ON "AuthThrottle"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_code_key" ON "Lot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_qrToken_key" ON "Lot"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Cooking_closureCode_key" ON "Cooking"("closureCode");

-- CreateIndex
CREATE INDEX "Cooking_lotId_idx" ON "Cooking"("lotId");

-- CreateIndex
CREATE INDEX "Cooking_equipmentId_idx" ON "Cooking"("equipmentId");

-- CreateIndex
CREATE INDEX "Cooking_finishedById_idx" ON "Cooking"("finishedById");

-- CreateIndex
CREATE INDEX "CookingEvent_cookingId_idx" ON "CookingEvent"("cookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Milling_closureCode_key" ON "Milling"("closureCode");

-- CreateIndex
CREATE INDEX "Milling_lotId_idx" ON "Milling"("lotId");

-- CreateIndex
CREATE INDEX "Milling_equipmentId_idx" ON "Milling"("equipmentId");

-- CreateIndex
CREATE INDEX "Milling_finishedById_idx" ON "Milling"("finishedById");

-- CreateIndex
CREATE INDEX "MillingEvent_millingId_idx" ON "MillingEvent"("millingId");

-- CreateIndex
CREATE UNIQUE INDEX "Fermentation_closureCode_key" ON "Fermentation"("closureCode");

-- CreateIndex
CREATE INDEX "Fermentation_lotId_idx" ON "Fermentation"("lotId");

-- CreateIndex
CREATE INDEX "Fermentation_finishedById_idx" ON "Fermentation"("finishedById");

-- CreateIndex
CREATE INDEX "FermentationReading_fermentationId_idx" ON "FermentationReading"("fermentationId");

-- CreateIndex
CREATE UNIQUE INDEX "Distillation_closureCode_key" ON "Distillation"("closureCode");

-- CreateIndex
CREATE INDEX "Distillation_lotId_idx" ON "Distillation"("lotId");

-- CreateIndex
CREATE INDEX "Distillation_equipmentId_idx" ON "Distillation"("equipmentId");

-- CreateIndex
CREATE INDEX "Distillation_finishedById_idx" ON "Distillation"("finishedById");

-- CreateIndex
CREATE INDEX "DistillationEvent_distillationId_idx" ON "DistillationEvent"("distillationId");

-- CreateIndex
CREATE INDEX "LotExpense_lotId_idx" ON "LotExpense"("lotId");

-- CreateIndex
CREATE INDEX "MillingDischarge_millingId_idx" ON "MillingDischarge"("millingId");

-- CreateIndex
CREATE INDEX "MillingDischarge_tankId_idx" ON "MillingDischarge"("tankId");

-- CreateIndex
CREATE INDEX "MillingDischarge_createdById_idx" ON "MillingDischarge"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_code_key" ON "RawMaterial"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_name_key" ON "RawMaterial"("name");

-- CreateIndex
CREATE INDEX "RawMaterial_active_idx" ON "RawMaterial"("active");

-- CreateIndex
CREATE INDEX "RawMaterial_category_idx" ON "RawMaterial"("category");

-- CreateIndex
CREATE INDEX "RawMaterialMovement_rawMaterialId_idx" ON "RawMaterialMovement"("rawMaterialId");

-- CreateIndex
CREATE INDEX "RawMaterialMovement_type_idx" ON "RawMaterialMovement"("type");

-- CreateIndex
CREATE INDEX "RawMaterialMovement_createdAt_idx" ON "RawMaterialMovement"("createdAt");

-- CreateIndex
CREATE INDEX "RawMaterialMovement_lotId_idx" ON "RawMaterialMovement"("lotId");

-- CreateIndex
CREATE INDEX "RawMaterialMovement_liquorBatchId_idx" ON "RawMaterialMovement"("liquorBatchId");

-- CreateIndex
CREATE INDEX "RawMaterialMovement_branchId_idx" ON "RawMaterialMovement"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorProduct_name_key" ON "LiquorProduct"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorProduct_slug_key" ON "LiquorProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorProduct_prefix_key" ON "LiquorProduct"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorProduct_inventoryProductId_key" ON "LiquorProduct"("inventoryProductId");

-- CreateIndex
CREATE INDEX "LiquorProduct_createdById_idx" ON "LiquorProduct"("createdById");

-- CreateIndex
CREATE INDEX "LiquorProduct_active_idx" ON "LiquorProduct"("active");

-- CreateIndex
CREATE INDEX "LiquorRecipe_productId_idx" ON "LiquorRecipe"("productId");

-- CreateIndex
CREATE INDEX "LiquorRecipe_createdById_idx" ON "LiquorRecipe"("createdById");

-- CreateIndex
CREATE INDEX "LiquorRecipe_active_idx" ON "LiquorRecipe"("active");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorRecipe_productId_version_key" ON "LiquorRecipe"("productId", "version");

-- CreateIndex
CREATE INDEX "LiquorRecipeStep_recipeId_idx" ON "LiquorRecipeStep"("recipeId");

-- CreateIndex
CREATE INDEX "LiquorRecipeStep_recipeIngredientId_idx" ON "LiquorRecipeStep"("recipeIngredientId");

-- CreateIndex
CREATE INDEX "LiquorRecipeStep_type_idx" ON "LiquorRecipeStep"("type");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorRecipeStep_recipeId_position_key" ON "LiquorRecipeStep"("recipeId", "position");

-- CreateIndex
CREATE INDEX "LiquorRecipeIngredient_recipeId_idx" ON "LiquorRecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "LiquorRecipeIngredient_rawMaterialId_idx" ON "LiquorRecipeIngredient"("rawMaterialId");

-- CreateIndex
CREATE INDEX "LiquorRecipeIngredient_position_idx" ON "LiquorRecipeIngredient"("position");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBatch_code_key" ON "LiquorBatch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBatch_sequence_key" ON "LiquorBatch"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBatch_closureCode_key" ON "LiquorBatch"("closureCode");

-- CreateIndex
CREATE INDEX "LiquorBatch_productId_idx" ON "LiquorBatch"("productId");

-- CreateIndex
CREATE INDEX "LiquorBatch_recipeId_idx" ON "LiquorBatch"("recipeId");

-- CreateIndex
CREATE INDEX "LiquorBatch_status_idx" ON "LiquorBatch"("status");

-- CreateIndex
CREATE INDEX "LiquorBatch_qualityStatus_idx" ON "LiquorBatch"("qualityStatus");

-- CreateIndex
CREATE INDEX "LiquorBatch_productionDate_idx" ON "LiquorBatch"("productionDate");

-- CreateIndex
CREATE INDEX "LiquorBatch_createdById_idx" ON "LiquorBatch"("createdById");

-- CreateIndex
CREATE INDEX "LiquorBatch_finishedById_idx" ON "LiquorBatch"("finishedById");

-- CreateIndex
CREATE INDEX "LiquorBatch_lotId_idx" ON "LiquorBatch"("lotId");

-- CreateIndex
CREATE INDEX "LiquorBatchEvent_batchId_idx" ON "LiquorBatchEvent"("batchId");

-- CreateIndex
CREATE INDEX "LiquorBatchEvent_type_idx" ON "LiquorBatchEvent"("type");

-- CreateIndex
CREATE INDEX "LiquorBatchEvent_createdById_idx" ON "LiquorBatchEvent"("createdById");

-- CreateIndex
CREATE INDEX "LiquorBatchEvent_createdAt_idx" ON "LiquorBatchEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LiquorBatchIngredient_batchId_idx" ON "LiquorBatchIngredient"("batchId");

-- CreateIndex
CREATE INDEX "LiquorBatchIngredient_recipeIngredientId_idx" ON "LiquorBatchIngredient"("recipeIngredientId");

-- CreateIndex
CREATE INDEX "LiquorBatchStep_batchId_idx" ON "LiquorBatchStep"("batchId");

-- CreateIndex
CREATE INDEX "LiquorBatchStep_recipeStepId_idx" ON "LiquorBatchStep"("recipeStepId");

-- CreateIndex
CREATE INDEX "LiquorBatchStep_batchIngredientId_idx" ON "LiquorBatchStep"("batchIngredientId");

-- CreateIndex
CREATE INDEX "LiquorBatchStep_status_idx" ON "LiquorBatchStep"("status");

-- CreateIndex
CREATE INDEX "LiquorBatchStep_completedById_idx" ON "LiquorBatchStep"("completedById");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBatchStep_batchId_position_key" ON "LiquorBatchStep"("batchId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBottling_code_key" ON "LiquorBottling"("code");

-- CreateIndex
CREATE INDEX "LiquorBottling_batchId_idx" ON "LiquorBottling"("batchId");

-- CreateIndex
CREATE INDEX "LiquorBottling_rawMaterialId_idx" ON "LiquorBottling"("rawMaterialId");

-- CreateIndex
CREATE INDEX "LiquorBottling_status_idx" ON "LiquorBottling"("status");

-- CreateIndex
CREATE INDEX "LiquorBottling_createdById_idx" ON "LiquorBottling"("createdById");

-- CreateIndex
CREATE INDEX "LiquorBottling_finishedById_idx" ON "LiquorBottling"("finishedById");

-- CreateIndex
CREATE INDEX "LiquorBottling_bottledAt_idx" ON "LiquorBottling"("bottledAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBottle_code_key" ON "LiquorBottle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBottle_qrToken_key" ON "LiquorBottle"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBottle_authenticityCode_key" ON "LiquorBottle"("authenticityCode");

-- CreateIndex
CREATE INDEX "LiquorBottle_bottlingId_idx" ON "LiquorBottle"("bottlingId");

-- CreateIndex
CREATE INDEX "LiquorBottle_status_idx" ON "LiquorBottle"("status");

-- CreateIndex
CREATE INDEX "LiquorBottle_expirationDate_idx" ON "LiquorBottle"("expirationDate");

-- CreateIndex
CREATE INDEX "LiquorBottle_branchId_idx" ON "LiquorBottle"("branchId");

-- CreateIndex
CREATE INDEX "LiquorBottle_soldAt_idx" ON "LiquorBottle"("soldAt");

-- CreateIndex
CREATE INDEX "LiquorBottle_soldById_idx" ON "LiquorBottle"("soldById");

-- CreateIndex
CREATE INDEX "LiquorBottle_manufacturedAt_idx" ON "LiquorBottle"("manufacturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiquorBottle_bottlingId_serialNumber_key" ON "LiquorBottle"("bottlingId", "serialNumber");

-- CreateIndex
CREATE INDEX "LiquorBottleMovement_bottleId_idx" ON "LiquorBottleMovement"("bottleId");

-- CreateIndex
CREATE INDEX "LiquorBottleMovement_type_idx" ON "LiquorBottleMovement"("type");

-- CreateIndex
CREATE INDEX "LiquorBottleMovement_userId_idx" ON "LiquorBottleMovement"("userId");

-- CreateIndex
CREATE INDEX "LiquorBottleMovement_fromBranchId_idx" ON "LiquorBottleMovement"("fromBranchId");

-- CreateIndex
CREATE INDEX "LiquorBottleMovement_toBranchId_idx" ON "LiquorBottleMovement"("toBranchId");

-- CreateIndex
CREATE INDEX "LiquorBottleMovement_createdAt_idx" ON "LiquorBottleMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_active_idx" ON "Branch"("active");

-- CreateIndex
CREATE INDEX "Branch_geofenceId_idx" ON "Branch"("geofenceId");

-- CreateIndex
CREATE INDEX "GeofenceAlert_userId_idx" ON "GeofenceAlert"("userId");

-- CreateIndex
CREATE INDEX "GeofenceAlert_branchId_idx" ON "GeofenceAlert"("branchId");

-- CreateIndex
CREATE INDEX "GeofenceAlert_createdAt_idx" ON "GeofenceAlert"("createdAt");

-- CreateIndex
CREATE INDEX "UserBranch_userId_idx" ON "UserBranch"("userId");

-- CreateIndex
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CashCut_code_key" ON "CashCut"("code");

-- CreateIndex
CREATE INDEX "CashCut_branchId_idx" ON "CashCut"("branchId");

-- CreateIndex
CREATE INDEX "CashCut_responsibleId_idx" ON "CashCut"("responsibleId");

-- CreateIndex
CREATE INDEX "CashCut_createdById_idx" ON "CashCut"("createdById");

-- CreateIndex
CREATE INDEX "CashCut_status_idx" ON "CashCut"("status");

-- CreateIndex
CREATE INDEX "CashCut_date_idx" ON "CashCut"("date");

-- CreateIndex
CREATE INDEX "CashCut_eventId_idx" ON "CashCut"("eventId");

-- CreateIndex
CREATE INDEX "CashCutDenomination_cashCutId_idx" ON "CashCutDenomination"("cashCutId");

-- CreateIndex
CREATE UNIQUE INDEX "CashCutDenomination_cashCutId_context_value_key" ON "CashCutDenomination"("cashCutId", "context", "value");

-- CreateIndex
CREATE INDEX "CashSalePayment_cashCutId_idx" ON "CashSalePayment"("cashCutId");

-- CreateIndex
CREATE UNIQUE INDEX "CashSalePayment_cashCutId_method_key" ON "CashSalePayment"("cashCutId", "method");

-- CreateIndex
CREATE INDEX "CashOutflow_cashCutId_idx" ON "CashOutflow"("cashCutId");

-- CreateIndex
CREATE INDEX "CashOutflow_authorizedById_idx" ON "CashOutflow"("authorizedById");

-- CreateIndex
CREATE INDEX "CashOutflow_category_idx" ON "CashOutflow"("category");

-- CreateIndex
CREATE INDEX "CashInflow_cashCutId_idx" ON "CashInflow"("cashCutId");

-- CreateIndex
CREATE INDEX "CashCutEvidence_cashCutId_idx" ON "CashCutEvidence"("cashCutId");

-- CreateIndex
CREATE INDEX "CashCutEvidence_type_idx" ON "CashCutEvidence"("type");

-- CreateIndex
CREATE INDEX "CashCutAuditEntry_cashCutId_idx" ON "CashCutAuditEntry"("cashCutId");

-- CreateIndex
CREATE INDEX "CashCutAuditEntry_userId_idx" ON "CashCutAuditEntry"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetCode_userId_idx" ON "PasswordResetCode"("userId");

-- CreateIndex
CREATE INDEX "CashSafeMovement_branchId_idx" ON "CashSafeMovement"("branchId");

-- CreateIndex
CREATE INDEX "CashSafeMovement_cashCutId_idx" ON "CashSafeMovement"("cashCutId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_code_key" ON "InventoryProduct"("code");

-- CreateIndex
CREATE INDEX "InventoryProduct_name_idx" ON "InventoryProduct"("name");

-- CreateIndex
CREATE INDEX "InventoryProduct_category_idx" ON "InventoryProduct"("category");

-- CreateIndex
CREATE INDEX "InventoryProduct_itemType_idx" ON "InventoryProduct"("itemType");

-- CreateIndex
CREATE INDEX "InventoryProduct_isActive_idx" ON "InventoryProduct"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackageItem_packageId_productId_key" ON "EventPackageItem"("packageId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEvent_code_key" ON "ServiceEvent"("code");

-- CreateIndex
CREATE INDEX "EventRecount_eventId_idx" ON "EventRecount"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRecount_eventId_dayNumber_key" ON "EventRecount"("eventId", "dayNumber");

-- CreateIndex
CREATE INDEX "EventRecountItem_recountId_idx" ON "EventRecountItem"("recountId");

-- CreateIndex
CREATE INDEX "EventRecountItem_eventItemId_idx" ON "EventRecountItem"("eventItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRecountItem_recountId_eventItemId_key" ON "EventRecountItem"("recountId", "eventItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentKit_name_key" ON "EquipmentKit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentKitItem_kitId_productId_key" ON "EquipmentKitItem"("kitId", "productId");

-- CreateIndex
CREATE INDEX "InventoryEntry_branchId_idx" ON "InventoryEntry"("branchId");

-- CreateIndex
CREATE INDEX "InventoryEntry_productId_idx" ON "InventoryEntry"("productId");

-- CreateIndex
CREATE INDEX "InventoryEntry_entryDate_idx" ON "InventoryEntry"("entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_code_key" ON "InventoryCount"("code");

-- CreateIndex
CREATE INDEX "InventoryCount_branchId_idx" ON "InventoryCount"("branchId");

-- CreateIndex
CREATE INDEX "InventoryCount_countDate_idx" ON "InventoryCount"("countDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountItem_countId_productId_key" ON "InventoryCountItem"("countId", "productId");

-- CreateIndex
CREATE INDEX "ModulePermission_userId_idx" ON "ModulePermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModulePermission_userId_moduleKey_key" ON "ModulePermission"("userId", "moduleKey");

-- CreateIndex
CREATE INDEX "TimeClockEntry_userId_idx" ON "TimeClockEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeClockEntry_branchId_idx" ON "TimeClockEntry"("branchId");

-- CreateIndex
CREATE INDEX "TimeClockEntry_clockIn_idx" ON "TimeClockEntry"("clockIn");

-- CreateIndex
CREATE INDEX "TimeClockEntry_scheduledShiftId_idx" ON "TimeClockEntry"("scheduledShiftId");

-- CreateIndex
CREATE INDEX "TimeClockEditRequest_timeClockId_idx" ON "TimeClockEditRequest"("timeClockId");

-- CreateIndex
CREATE INDEX "TimeClockEditRequest_userId_idx" ON "TimeClockEditRequest"("userId");

-- CreateIndex
CREATE INDEX "TimeClockEditRequest_status_idx" ON "TimeClockEditRequest"("status");

-- CreateIndex
CREATE INDEX "ScheduledShift_userId_idx" ON "ScheduledShift"("userId");

-- CreateIndex
CREATE INDEX "ScheduledShift_branchId_idx" ON "ScheduledShift"("branchId");

-- CreateIndex
CREATE INDEX "ScheduledShift_date_idx" ON "ScheduledShift"("date");

-- CreateIndex
CREATE INDEX "ScheduledShift_eventId_idx" ON "ScheduledShift"("eventId");

-- CreateIndex
CREATE INDEX "AvailabilityOverrideAudit_shiftId_idx" ON "AvailabilityOverrideAudit"("shiftId");

-- CreateIndex
CREATE INDEX "AvailabilityOverrideAudit_userId_createdAt_idx" ON "AvailabilityOverrideAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftChangeRequest_requestedById_status_idx" ON "ShiftChangeRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "ShiftChangeRequest_shiftId_status_idx" ON "ShiftChangeRequest"("shiftId", "status");

-- CreateIndex
CREATE INDEX "ShiftChangeRequest_status_createdAt_idx" ON "ShiftChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SalaryRate_userId_effectiveFrom_idx" ON "SalaryRate"("userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleWeek_weekStart_key" ON "ScheduleWeek"("weekStart");

-- CreateIndex
CREATE INDEX "ScheduleWeek_status_idx" ON "ScheduleWeek"("status");

-- CreateIndex
CREATE INDEX "EmployeeAvailabilityRule_userId_idx" ON "EmployeeAvailabilityRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAvailabilityRule_userId_dayOfWeek_key" ON "EmployeeAvailabilityRule"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "EmployeeAvailabilityException_userId_date_idx" ON "EmployeeAvailabilityException"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAvailabilityException_userId_date_key" ON "EmployeeAvailabilityException"("userId", "date");

-- CreateIndex
CREATE INDEX "BranchScheduleTemplate_branchId_idx" ON "BranchScheduleTemplate"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchScheduleTemplate_branchId_dayOfWeek_key" ON "BranchScheduleTemplate"("branchId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleTemplate_branchId_idx" ON "ScheduleTemplate"("branchId");

-- CreateIndex
CREATE INDEX "ScheduleTemplateShift_templateId_idx" ON "ScheduleTemplateShift"("templateId");

-- CreateIndex
CREATE INDEX "ScheduleTemplateShift_userId_idx" ON "ScheduleTemplateShift"("userId");

-- CreateIndex
CREATE INDEX "ScheduleTemplateShift_branchId_idx" ON "ScheduleTemplateShift"("branchId");

-- CreateIndex
CREATE INDEX "ScheduleEvent_date_idx" ON "ScheduleEvent"("date");

-- CreateIndex
CREATE INDEX "ScheduleEvent_branchId_idx" ON "ScheduleEvent"("branchId");

-- CreateIndex
CREATE INDEX "OvertimeRecord_weekStart_idx" ON "OvertimeRecord"("weekStart");

-- CreateIndex
CREATE INDEX "OvertimeRecord_status_idx" ON "OvertimeRecord"("status");

-- CreateIndex
CREATE INDEX "OvertimeRecord_userId_idx" ON "OvertimeRecord"("userId");

-- CreateIndex
CREATE INDEX "OvertimeRecord_branchId_idx" ON "OvertimeRecord"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRecord_userId_branchId_weekStart_key" ON "OvertimeRecord"("userId", "branchId", "weekStart");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_userId_weekStart_idx" ON "PayrollAdjustment"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_weekStart_idx" ON "PayrollAdjustment"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_weekStart_key" ON "PayrollPeriod"("weekStart");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE INDEX "PayrollEntry_userId_idx" ON "PayrollEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_periodId_userId_key" ON "PayrollEntry"("periodId", "userId");

-- CreateIndex
CREATE INDEX "PayrollIncidentJustification_userId_date_idx" ON "PayrollIncidentJustification"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollIncidentJustification_userId_date_key" ON "PayrollIncidentJustification"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSettings_branchId_key" ON "PayrollSettings"("branchId");

-- CreateIndex
CREATE INDEX "PosCategory_position_idx" ON "PosCategory"("position");

-- CreateIndex
CREATE INDEX "PosProduct_categoryId_idx" ON "PosProduct"("categoryId");

-- CreateIndex
CREATE INDEX "PosProductVariant_productId_idx" ON "PosProductVariant"("productId");

-- CreateIndex
CREATE INDEX "PosVariantIngredient_variantId_idx" ON "PosVariantIngredient"("variantId");

-- CreateIndex
CREATE INDEX "PosVariantIngredient_inventoryProductId_idx" ON "PosVariantIngredient"("inventoryProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PosVariantIngredient_variantId_inventoryProductId_key" ON "PosVariantIngredient"("variantId", "inventoryProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_code_key" ON "PosSale"("code");

-- CreateIndex
CREATE INDEX "PosSale_branchId_idx" ON "PosSale"("branchId");

-- CreateIndex
CREATE INDEX "PosSale_cashCutId_idx" ON "PosSale"("cashCutId");

-- CreateIndex
CREATE INDEX "PosSale_soldById_idx" ON "PosSale"("soldById");

-- CreateIndex
CREATE INDEX "PosSale_status_idx" ON "PosSale"("status");

-- CreateIndex
CREATE INDEX "PosSale_createdAt_idx" ON "PosSale"("createdAt");

-- CreateIndex
CREATE INDEX "PosSale_employeeBuyerId_idx" ON "PosSale"("employeeBuyerId");

-- CreateIndex
CREATE INDEX "PosSale_discountKind_idx" ON "PosSale"("discountKind");

-- CreateIndex
CREATE INDEX "PosSaleItem_saleId_idx" ON "PosSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "PosSaleItem_variantId_idx" ON "PosSaleItem"("variantId");

-- CreateIndex
CREATE INDEX "PosSaleItem_discountKind_idx" ON "PosSaleItem"("discountKind");

-- CreateIndex
CREATE INDEX "PosSaleItem_beneficiaryEmployeeId_idx" ON "PosSaleItem"("beneficiaryEmployeeId");

-- CreateIndex
CREATE INDEX "PosSalePayment_saleId_idx" ON "PosSalePayment"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "PosDiscountLimit_role_key" ON "PosDiscountLimit"("role");

-- CreateIndex
CREATE INDEX "PosDiscountRule_active_mode_idx" ON "PosDiscountRule"("active", "mode");

-- CreateIndex
CREATE INDEX "PosDiscountRule_startDate_endDate_idx" ON "PosDiscountRule"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "NotificationRule_active_idx" ON "NotificationRule"("active");

-- CreateIndex
CREATE INDEX "NotificationRule_triggerType_idx" ON "NotificationRule"("triggerType");

-- CreateIndex
CREATE INDEX "EventAddedProduct_eventId_idx" ON "EventAddedProduct"("eventId");

-- CreateIndex
CREATE INDEX "EventAddedProduct_productId_idx" ON "EventAddedProduct"("productId");

-- CreateIndex
CREATE INDEX "EventAddedProduct_status_idx" ON "EventAddedProduct"("status");

-- CreateIndex
CREATE INDEX "EventAddedProduct_sourceBranchId_idx" ON "EventAddedProduct"("sourceBranchId");

-- CreateIndex
CREATE INDEX "EventAddedProductLog_addedProductId_idx" ON "EventAddedProductLog"("addedProductId");

-- CreateIndex
CREATE INDEX "_BranchToPosDiscountRule_B_index" ON "_BranchToPosDiscountRule"("B");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooking" ADD CONSTRAINT "Cooking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooking" ADD CONSTRAINT "Cooking_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooking" ADD CONSTRAINT "Cooking_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingEvent" ADD CONSTRAINT "CookingEvent_cookingId_fkey" FOREIGN KEY ("cookingId") REFERENCES "Cooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milling" ADD CONSTRAINT "Milling_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milling" ADD CONSTRAINT "Milling_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milling" ADD CONSTRAINT "Milling_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingEvent" ADD CONSTRAINT "MillingEvent_millingId_fkey" FOREIGN KEY ("millingId") REFERENCES "Milling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fermentation" ADD CONSTRAINT "Fermentation_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fermentation" ADD CONSTRAINT "Fermentation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FermentationReading" ADD CONSTRAINT "FermentationReading_fermentationId_fkey" FOREIGN KEY ("fermentationId") REFERENCES "Fermentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistillationEvent" ADD CONSTRAINT "DistillationEvent_distillationId_fkey" FOREIGN KEY ("distillationId") REFERENCES "Distillation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotExpense" ADD CONSTRAINT "LotExpense_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingDischarge" ADD CONSTRAINT "MillingDischarge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingDischarge" ADD CONSTRAINT "MillingDischarge_millingId_fkey" FOREIGN KEY ("millingId") REFERENCES "Milling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingDischarge" ADD CONSTRAINT "MillingDischarge_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialMovement" ADD CONSTRAINT "RawMaterialMovement_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialMovement" ADD CONSTRAINT "RawMaterialMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialMovement" ADD CONSTRAINT "RawMaterialMovement_liquorBatchId_fkey" FOREIGN KEY ("liquorBatchId") REFERENCES "LiquorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialMovement" ADD CONSTRAINT "RawMaterialMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialMovement" ADD CONSTRAINT "RawMaterialMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorProduct" ADD CONSTRAINT "LiquorProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorProduct" ADD CONSTRAINT "LiquorProduct_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorRecipe" ADD CONSTRAINT "LiquorRecipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorRecipe" ADD CONSTRAINT "LiquorRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LiquorProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorRecipeStep" ADD CONSTRAINT "LiquorRecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "LiquorRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorRecipeStep" ADD CONSTRAINT "LiquorRecipeStep_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "LiquorRecipeIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorRecipeIngredient" ADD CONSTRAINT "LiquorRecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "LiquorRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorRecipeIngredient" ADD CONSTRAINT "LiquorRecipeIngredient_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatch" ADD CONSTRAINT "LiquorBatch_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatch" ADD CONSTRAINT "LiquorBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatch" ADD CONSTRAINT "LiquorBatch_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatch" ADD CONSTRAINT "LiquorBatch_pausedById_fkey" FOREIGN KEY ("pausedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatch" ADD CONSTRAINT "LiquorBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LiquorProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatch" ADD CONSTRAINT "LiquorBatch_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "LiquorRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchEvent" ADD CONSTRAINT "LiquorBatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LiquorBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchEvent" ADD CONSTRAINT "LiquorBatchEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchIngredient" ADD CONSTRAINT "LiquorBatchIngredient_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LiquorBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchIngredient" ADD CONSTRAINT "LiquorBatchIngredient_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "LiquorRecipeIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchStep" ADD CONSTRAINT "LiquorBatchStep_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LiquorBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchStep" ADD CONSTRAINT "LiquorBatchStep_batchIngredientId_fkey" FOREIGN KEY ("batchIngredientId") REFERENCES "LiquorBatchIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchStep" ADD CONSTRAINT "LiquorBatchStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBatchStep" ADD CONSTRAINT "LiquorBatchStep_recipeStepId_fkey" FOREIGN KEY ("recipeStepId") REFERENCES "LiquorRecipeStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottling" ADD CONSTRAINT "LiquorBottling_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LiquorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottling" ADD CONSTRAINT "LiquorBottling_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottling" ADD CONSTRAINT "LiquorBottling_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottling" ADD CONSTRAINT "LiquorBottling_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottle" ADD CONSTRAINT "LiquorBottle_bottlingId_fkey" FOREIGN KEY ("bottlingId") REFERENCES "LiquorBottling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottle" ADD CONSTRAINT "LiquorBottle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottle" ADD CONSTRAINT "LiquorBottle_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottleMovement" ADD CONSTRAINT "LiquorBottleMovement_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "LiquorBottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottleMovement" ADD CONSTRAINT "LiquorBottleMovement_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottleMovement" ADD CONSTRAINT "LiquorBottleMovement_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorBottleMovement" ADD CONSTRAINT "LiquorBottleMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "Geofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceAlert" ADD CONSTRAINT "GeofenceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceAlert" ADD CONSTRAINT "GeofenceAlert_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceAlert" ADD CONSTRAINT "GeofenceAlert_timeClockId_fkey" FOREIGN KEY ("timeClockId") REFERENCES "TimeClockEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ServiceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCut" ADD CONSTRAINT "CashCut_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCutDenomination" ADD CONSTRAINT "CashCutDenomination_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSalePayment" ADD CONSTRAINT "CashSalePayment_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOutflow" ADD CONSTRAINT "CashOutflow_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOutflow" ADD CONSTRAINT "CashOutflow_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashInflow" ADD CONSTRAINT "CashInflow_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCutEvidence" ADD CONSTRAINT "CashCutEvidence_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCutAuditEntry" ADD CONSTRAINT "CashCutAuditEntry_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCutAuditEntry" ADD CONSTRAINT "CashCutAuditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "PasswordResetCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeMovement" ADD CONSTRAINT "CashSafeMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeMovement" ADD CONSTRAINT "CashSafeMovement_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeMovement" ADD CONSTRAINT "CashSafeMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackageItem" ADD CONSTRAINT "EventPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackageItem" ADD CONSTRAINT "EventPackageItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEvent" ADD CONSTRAINT "ServiceEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEvent" ADD CONSTRAINT "ServiceEvent_equipmentKitId_fkey" FOREIGN KEY ("equipmentKitId") REFERENCES "EquipmentKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEventItem" ADD CONSTRAINT "ServiceEventItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEventItem" ADD CONSTRAINT "ServiceEventItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecount" ADD CONSTRAINT "EventRecount_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecountItem" ADD CONSTRAINT "EventRecountItem_recountId_fkey" FOREIGN KEY ("recountId") REFERENCES "EventRecount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecountItem" ADD CONSTRAINT "EventRecountItem_eventItemId_fkey" FOREIGN KEY ("eventItemId") REFERENCES "ServiceEventItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentKitItem" ADD CONSTRAINT "EquipmentKitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "EquipmentKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentKitItem" ADD CONSTRAINT "EquipmentKitItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModulePermission" ADD CONSTRAINT "ModulePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEntry" ADD CONSTRAINT "TimeClockEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEntry" ADD CONSTRAINT "TimeClockEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEntry" ADD CONSTRAINT "TimeClockEntry_closedManuallyById_fkey" FOREIGN KEY ("closedManuallyById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEntry" ADD CONSTRAINT "TimeClockEntry_scheduledShiftId_fkey" FOREIGN KEY ("scheduledShiftId") REFERENCES "ScheduledShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEditRequest" ADD CONSTRAINT "TimeClockEditRequest_timeClockId_fkey" FOREIGN KEY ("timeClockId") REFERENCES "TimeClockEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEditRequest" ADD CONSTRAINT "TimeClockEditRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeClockEditRequest" ADD CONSTRAINT "TimeClockEditRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduleEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityOverrideAudit" ADD CONSTRAINT "AvailabilityOverrideAudit_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ScheduledShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityOverrideAudit" ADD CONSTRAINT "AvailabilityOverrideAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityOverrideAudit" ADD CONSTRAINT "AvailabilityOverrideAudit_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ScheduledShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_swapTargetUserId_fkey" FOREIGN KEY ("swapTargetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRate" ADD CONSTRAINT "SalaryRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRate" ADD CONSTRAINT "SalaryRate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWeek" ADD CONSTRAINT "ScheduleWeek_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAvailabilityRule" ADD CONSTRAINT "EmployeeAvailabilityRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAvailabilityException" ADD CONSTRAINT "EmployeeAvailabilityException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySettings" ADD CONSTRAINT "AvailabilitySettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchScheduleTemplate" ADD CONSTRAINT "BranchScheduleTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplateShift" ADD CONSTRAINT "ScheduleTemplateShift_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScheduleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplateShift" ADD CONSTRAINT "ScheduleTemplateShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplateShift" ADD CONSTRAINT "ScheduleTemplateShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollIncidentJustification" ADD CONSTRAINT "PayrollIncidentJustification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollIncidentJustification" ADD CONSTRAINT "PayrollIncidentJustification_justifiedById_fkey" FOREIGN KEY ("justifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettings" ADD CONSTRAINT "PayrollSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCategory" ADD CONSTRAINT "PosCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProduct" ADD CONSTRAINT "PosProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PosCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProduct" ADD CONSTRAINT "PosProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProductVariant" ADD CONSTRAINT "PosProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosVariantIngredient" ADD CONSTRAINT "PosVariantIngredient_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PosProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosVariantIngredient" ADD CONSTRAINT "PosVariantIngredient_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_employeeBuyerId_fkey" FOREIGN KEY ("employeeBuyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PosProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_beneficiaryEmployeeId_fkey" FOREIGN KEY ("beneficiaryEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSalePayment" ADD CONSTRAINT "PosSalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDiscountLimit" ADD CONSTRAINT "PosDiscountLimit_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDiscountRule" ADD CONSTRAINT "PosDiscountRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDiscountRule" ADD CONSTRAINT "PosDiscountRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSettings" ADD CONSTRAINT "PosSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProduct" ADD CONSTRAINT "EventAddedProduct_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProduct" ADD CONSTRAINT "EventAddedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProduct" ADD CONSTRAINT "EventAddedProduct_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProduct" ADD CONSTRAINT "EventAddedProduct_returnBranchId_fkey" FOREIGN KEY ("returnBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProduct" ADD CONSTRAINT "EventAddedProduct_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProduct" ADD CONSTRAINT "EventAddedProduct_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProductLog" ADD CONSTRAINT "EventAddedProductLog_addedProductId_fkey" FOREIGN KEY ("addedProductId") REFERENCES "EventAddedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddedProductLog" ADD CONSTRAINT "EventAddedProductLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToPosDiscountRule" ADD CONSTRAINT "_BranchToPosDiscountRule_A_fkey" FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToPosDiscountRule" ADD CONSTRAINT "_BranchToPosDiscountRule_B_fkey" FOREIGN KEY ("B") REFERENCES "PosDiscountRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Row Level Security
-- Prisma no modela RLS, asi que 'migrate diff' no lo genera.
-- Se agrega aqui para que una base reconstruida desde cero
-- conserve la seguridad a nivel de fila de las ventas del POS.
-- Capturado de produccion el 19-ago-2026.
-- ============================================================

ALTER TABLE "PosSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSale" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PosSaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSaleItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PosSalePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSalePayment" FORCE ROW LEVEL SECURITY;

-- 3 policies
CREATE POLICY "pos_sale_branch_access" ON "PosSale"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((COALESCE(current_setting('app.is_admin'::text, true), 'false'::text) = 'true'::text) OR (EXISTS ( SELECT 1
   FROM "UserBranch"
  WHERE (("UserBranch"."userId" = current_setting('app.current_user_id'::text, true)) AND ("UserBranch"."branchId" = "PosSale"."branchId"))))))
  WITH CHECK (((COALESCE(current_setting('app.is_admin'::text, true), 'false'::text) = 'true'::text) OR (EXISTS ( SELECT 1
   FROM "UserBranch"
  WHERE (("UserBranch"."userId" = current_setting('app.current_user_id'::text, true)) AND ("UserBranch"."branchId" = "PosSale"."branchId"))))));

CREATE POLICY "pos_sale_item_parent_access" ON "PosSaleItem"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1
   FROM "PosSale"
  WHERE ("PosSale".id = "PosSaleItem"."saleId"))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM "PosSale"
  WHERE ("PosSale".id = "PosSaleItem"."saleId"))));

CREATE POLICY "pos_sale_payment_parent_access" ON "PosSalePayment"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1
   FROM "PosSale"
  WHERE ("PosSale".id = "PosSalePayment"."saleId"))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM "PosSale"
  WHERE ("PosSale".id = "PosSalePayment"."saleId"))));

