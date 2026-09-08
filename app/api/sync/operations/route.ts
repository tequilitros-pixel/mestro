import { NextResponse } from "next/server";
import {
  CookingEventType,
  CookingStatus,
  DistillationEventType,
  DistillationStatus,
  FermentationStatus,
  MillingEventType,
  MillingStatus,
  BoilerEventType,
  BoilerSource,
  GasReadingType,
  PressureUnit,
} from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { canUserAccessModule } from "@/lib/moduleAccess";
import { prisma } from "@/lib/prisma";
import { getProductionOperationModuleKey } from "@/lib/offline/production";
import type { OfflineOperation } from "@/lib/offline/types";
import { createBoilerEvent, createBoilerIncident, createBoilerMaintenance, createGasReading, createPressureReading, createSweetHoneyRecovery, startBoilerSession, startSteamInterval, stopBoilerSession, stopSteamInterval } from "@/lib/boiler/service";

type Payload = Record<string, string | number | boolean | null | undefined>;
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.active) return fail("Sesión no autorizada", 401);

  const operation = (await request.json().catch(() => null)) as OfflineOperation | null;
  if (!operation?.id || !operation.createdAt || !operation.payload) {
    return fail("Operación inválida", 400);
  }

  const moduleKey = getProductionOperationModuleKey(operation.kind);
  if (!moduleKey) return fail("Tipo de operación no compatible", 400);
  if (!(await canUserAccessModule(user, moduleKey))) {
    return fail("Sin permiso para el módulo solicitado", 403);
  }

  const createdAt = new Date(operation.createdAt);
  if (Number.isNaN(createdAt.getTime())) return fail("Fecha de operación inválida", 400);
  const payload = operation.payload as Payload;

  try {
    switch (operation.kind) {
      case "cooking.event.create":
        await syncCookingEvent(operation.id, createdAt, payload);
        break;
      case "boiler.session.start":
        await startBoilerSession({ operationId: operation.id, equipmentId: requiredString(payload.equipmentId, "Falta la Caldera"), actorId: user.id, occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), initialGasPercent: optionalNumber(payload.initialGasPercent), notes: optionalString(payload.notes) });
        break;
      case "boiler.session.stop":
        await stopBoilerSession({ operationId: operation.id, sessionId: requiredString(payload.sessionId, "Falta la sesión"), actorId: user.id, occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), closeReason: optionalString(payload.closeReason) });
        break;
      case "boiler.gas.reading.create":
        await createGasReading({ operationId: operation.id, sessionId: requiredString(payload.sessionId, "Falta la sesión"), actorId: user.id, percent: requiredNumber(payload.percent, "Porcentaje de gas inválido"), type: enumValue(payload.type, GasReadingType, "Tipo de gas inválido"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "boiler.pressure.reading.create":
        await createPressureReading({ operationId: operation.id, sessionId: requiredString(payload.sessionId, "Falta la sesión"), intervalId: optionalString(payload.intervalId), actorId: user.id, value: requiredNumber(payload.value, "Presión inválida"), unit: enumValue(payload.unit, PressureUnit, "Unidad de presión inválida"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "boiler.event.create":
        await createBoilerEvent({ operationId: operation.id, sessionId: optionalString(payload.sessionId), actorId: user.id, type: enumValue(payload.type, BoilerEventType, "Evento de Caldera inválido"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "boiler.maintenance.create":
        await createBoilerMaintenance({ operationId: operation.id, equipmentId: requiredString(payload.equipmentId, "Falta la Caldera"), actorId: user.id, notes: requiredString(payload.notes, "Faltan notas"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida") });
        break;
      case "boiler.incident.create":
        await createBoilerIncident({ operationId: operation.id, equipmentId: requiredString(payload.equipmentId, "Falta la Caldera"), sessionId: optionalString(payload.sessionId), actorId: user.id, notes: requiredString(payload.notes, "Faltan notas"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida") });
        break;
      case "steam.interval.start":
        await startSteamInterval({ operationId: operation.id, cookingId: requiredString(payload.cookingId, "Falta la cocción"), boilerSessionId: optionalString(payload.boilerSessionId) ?? undefined, actorId: user.id, pressureValue: requiredNumber(payload.pressureValue, "Presión inválida"), pressureUnit: enumValue(payload.pressureUnit, PressureUnit, "Unidad de presión inválida"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "steam.pressure.create":
        await createPressureReading({ operationId: operation.id, sessionId: requiredString(payload.boilerSessionId, "Falta la sesión"), intervalId: requiredString(payload.intervalId, "Falta el intervalo"), actorId: user.id, value: requiredNumber(payload.pressureValue, "Presión inválida"), unit: enumValue(payload.pressureUnit, PressureUnit, "Unidad de presión inválida"), occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "steam.interval.stop":
        await stopSteamInterval({ operationId: operation.id, cookingId: requiredString(payload.cookingId, "Falta la cocción"), actorId: user.id, occurredAt: optionalDate(payload.occurredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "sweet-honey.recovery.create":
        await createSweetHoneyRecovery({ operationId: operation.id, lotId: requiredString(payload.lotId, "Falta el lote"), sourceCookingId: requiredString(payload.sourceCookingId, "Falta la cocción origen"), destinationTankId: optionalString(payload.destinationTankId), liters: requiredNumber(payload.liters, "Litros inválidos"), brix: optionalNumber(payload.brix), actorId: user.id, recoveredAt: optionalDate(payload.recoveredAt) ?? createdAt, source: enumValue(payload.source, BoilerSource, "Fuente inválida"), notes: optionalString(payload.notes) });
        break;
      case "milling.discharge.create":
        await syncMillingDischarge(operation.id, createdAt, payload, user.id);
        break;
      case "fermentation.reading.create":
        await syncFermentationReading(operation.id, createdAt, payload);
        break;
      case "distillation.event.create":
        await syncDistillationEvent(operation.id, createdAt, payload);
        break;
      default:
        return fail("Tipo de operación no compatible", 400);
    }
  } catch (error) {
    if (error instanceof SyncValidationError) return fail(error.message, error.status);
    throw error;
  }

  return NextResponse.json({ success: true });
}

async function syncCookingEvent(id: string, createdAt: Date, payload: Payload) {
  const cookingId = requiredString(payload.cookingId, "Falta la cocción");
  const type = enumValue(payload.type, CookingEventType, "Evento de cocción inválido");
  if (type === CookingEventType.FIN_COCCION) invalid("El cierre requiere el acta oficial", 409);

  const cooking = await prisma.cooking.findUnique({ where: { id: cookingId }, select: { status: true, closureCode: true } });
  if (!cooking || cooking.status === CookingStatus.TERMINADA || cooking.closureCode) invalid("La cocción ya está cerrada", 409);

  const temperatureTop = optionalNumber(payload.temperatureTop);
  const temperatureMiddle = optionalNumber(payload.temperatureMiddle);
  const temperatureBottom = optionalNumber(payload.temperatureBottom);
  const liters = optionalNumber(payload.liters);
  const ph = optionalNumber(payload.ph);
  const brix = optionalNumber(payload.brix);
  const temperature = optionalNumber(payload.temperature);
  const notes = optionalString(payload.notes);

  if (type === CookingEventType.TEMPERATURA && [temperatureTop, temperatureMiddle, temperatureBottom].some((v) => v === null || v < 0)) invalid("Las tres temperaturas son obligatorias");
  validateNonNegative([liters, brix, temperature]);
  validatePh(ph);
  const cookingDetails = new Set<CookingEventType>([CookingEventType.MIELES_AMARGAS, CookingEventType.MIELES_DULCES, CookingEventType.OBSERVACION]);
  if (cookingDetails.has(type) && [liters, ph, brix, temperature].every((v) => v === null) && !notes) invalid("Faltan datos del evento");

  await prisma.cookingEvent.upsert({
    where: { id }, update: {},
    create: { id, cookingId, type, temperatureTop, temperatureMiddle, temperatureBottom, liters, ph, brix, temperature, notes, createdAt },
  });
}

async function syncMillingDischarge(id: string, createdAt: Date, payload: Payload, userId: string) {
  const millingId = requiredString(payload.millingId, "Falta la molienda");
  const litersRecovered = requiredNumber(payload.litersRecovered, "Litros recuperados inválidos");
  const brix = requiredNumber(payload.brix, "°Brix inválido");
  const ph = requiredNumber(payload.ph, "pH inválido");
  const temperature = requiredNumber(payload.temperature, "Temperatura inválida");
  const tankId = optionalString(payload.tankId);
  const notes = optionalString(payload.notes);
  if (litersRecovered <= 0 || brix < 0 || temperature < 0) invalid("Las mediciones de descarga no son válidas");
  validatePh(ph);

  const milling = await prisma.milling.findUnique({ where: { id: millingId }, select: { status: true, closureCode: true } });
  if (!milling || milling.status === MillingStatus.TERMINADA || milling.closureCode) invalid("La molienda ya está cerrada", 409);
  if (tankId && !(await prisma.equipment.findFirst({ where: { id: tankId, type: "TINA", active: true }, select: { id: true } }))) invalid("La tina seleccionada no está disponible", 409);

  await prisma.$transaction(async (tx) => {
    await tx.millingDischarge.upsert({
      where: { id }, update: {},
      create: { id, millingId, tankId, litersRecovered, brix, ph, temperature, notes, createdById: userId, createdAt },
    });
    await tx.millingEvent.upsert({
      where: { id: `${id}:event` }, update: {},
      create: { id: `${id}:event`, millingId, type: MillingEventType.OBSERVACION, brix, ph, temperature, notes: notes ?? `Descarga de ${litersRecovered} L registrada${tankId ? " hacia tina asignada" : ""}.`, createdAt },
    });
  });
}

async function syncFermentationReading(id: string, createdAt: Date, payload: Payload) {
  const fermentationId = requiredString(payload.fermentationId, "Falta la fermentación");
  const brix = optionalNumber(payload.brix);
  const ph = optionalNumber(payload.ph);
  const temperature = optionalNumber(payload.temperature);
  const alcohol = optionalNumber(payload.alcohol);
  const saccharometer = optionalNumber(payload.saccharometer);
  const citricAcidGrams = optionalNumber(payload.citricAcidGrams);
  const bicarbonateGrams = optionalNumber(payload.bicarbonateGrams);
  const heating = optionalNumber(payload.heatingMinutes);
  const notes = optionalString(payload.notes);
  if ([brix, ph, temperature, alcohol, saccharometer, citricAcidGrams, bicarbonateGrams, heating].every((v) => v === null) && !notes) invalid("La lectura está vacía");
  validateNonNegative([brix, temperature, alcohol, citricAcidGrams, bicarbonateGrams, heating]);
  validatePh(ph);
  if (alcohol !== null && alcohol > 100) invalid("El alcohol debe estar entre 0 y 100");

  const fermentation = await prisma.fermentation.findUnique({ where: { id: fermentationId }, select: { status: true, closureCode: true } });
  if (!fermentation || fermentation.status === FermentationStatus.TERMINADA || fermentation.closureCode) invalid("La fermentación ya está cerrada", 409);

  await prisma.fermentationReading.upsert({
    where: { id }, update: {},
    create: { id, fermentationId, brix, ph, temperature, alcohol, saccharometer, citricAcidGrams, bicarbonateGrams, heated: heating !== null && heating > 0, heatingMinutes: heating === null ? null : Math.round(heating), notes, createdAt },
  });
}

async function syncDistillationEvent(id: string, createdAt: Date, payload: Payload) {
  const distillationId = requiredString(payload.distillationId, "Falta la destilación");
  const type = enumValue(payload.type, DistillationEventType, "Evento de destilación inválido");
  if (type === DistillationEventType.FIN_DESTILACION) invalid("El cierre requiere el acta oficial", 409);
  const temperature = optionalNumber(payload.temperature);
  const outputTemperature = optionalNumber(payload.outputTemperature);
  const alcohol = optionalNumber(payload.alcohol);
  const alcoholCorrected = optionalNumber(payload.alcoholCorrected);
  const liters = optionalNumber(payload.liters);
  const notes = optionalString(payload.notes);
  validateNonNegative([temperature, outputTemperature, liters]);
  for (const value of [alcohol, alcoholCorrected]) if (value !== null && (value < 0 || value > 100)) invalid("El alcohol debe estar entre 0 y 100");
  const actionEvents = new Set<DistillationEventType>([DistillationEventType.INICIO_CALENTAMIENTO, DistillationEventType.CORTE_CABEZAS, DistillationEventType.INICIO_CORAZON, DistillationEventType.FIN_CORAZON, DistillationEventType.INICIO_COLAS]);
  const actionOnly = actionEvents.has(type);
  if (!actionOnly && [temperature, outputTemperature, alcohol, alcoholCorrected, liters].every((v) => v === null) && !notes) invalid("El registro está vacío");

  const distillation = await prisma.distillation.findUnique({ where: { id: distillationId }, select: { status: true, closureCode: true } });
  if (!distillation || distillation.status === DistillationStatus.TERMINADA || distillation.closureCode) invalid("La destilación ya está cerrada", 409);

  await prisma.distillationEvent.upsert({
    where: { id }, update: {},
    create: { id, distillationId, type, temperature, outputTemperature, alcohol, alcoholCorrected, liters, notes, createdAt },
  });
}

class SyncValidationError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function invalid(message: string, status = 400): never { throw new SyncValidationError(message, status); }
function fail(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }
function optionalString(value: Payload[string]) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function requiredString(value: Payload[string], message: string) { return optionalString(value) ?? invalid(message); }
function optionalNumber(value: Payload[string]) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : invalid("Valor numérico inválido"); }
function requiredNumber(value: Payload[string], message: string) { return optionalNumber(value) ?? invalid(message); }
function optionalDate(value: Payload[string]) { if (!value) return null; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? invalid("Fecha inválida") : parsed; }
function validateNonNegative(values: Array<number | null>) { if (values.some((value) => value !== null && value < 0)) invalid("Los valores no pueden ser negativos"); }
function validatePh(value: number | null) { if (value !== null && (value < 0 || value > 14)) invalid("El pH debe estar entre 0 y 14"); }
function enumValue<T extends string>(value: Payload[string], values: Record<string, T>, message: string): T { const text = optionalString(value) ?? "MANUAL"; return Object.values(values).includes(text as T) ? text as T : invalid(message); }
