import { NextResponse } from "next/server";
import {
  CookingEventType,
  CookingStatus,
  DistillationEventType,
  DistillationStatus,
  FermentationStatus,
  MillingEventType,
  MillingStatus,
} from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OfflineOperation } from "@/lib/offline/types";

type Payload = Record<string, string | number | boolean | null | undefined>;
type SyncUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.active) return fail("Sesión no autorizada", 401);
  if (!(await canUseProduction(user))) return fail("Sin permiso para Producción", 403);

  const operation = (await request.json().catch(() => null)) as OfflineOperation | null;
  if (!operation?.id || !operation.createdAt || !operation.payload) {
    return fail("Operación inválida", 400);
  }

  const createdAt = new Date(operation.createdAt);
  if (Number.isNaN(createdAt.getTime())) return fail("Fecha de operación inválida", 400);
  const payload = operation.payload as Payload;

  try {
    switch (operation.kind) {
      case "cooking.event.create":
        await syncCookingEvent(operation.id, createdAt, payload);
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

async function canUseProduction(user: SyncUser) {
  if (user.role === "ADMIN" || user.role === "OPERATOR") return true;
  return Boolean(await prisma.modulePermission.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey: "production" } },
  }));
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
function validateNonNegative(values: Array<number | null>) { if (values.some((value) => value !== null && value < 0)) invalid("Los valores no pueden ser negativos"); }
function validatePh(value: number | null) { if (value !== null && (value < 0 || value > 14)) invalid("El pH debe estar entre 0 y 14"); }
function enumValue<T extends string>(value: Payload[string], values: Record<string, T>, message: string): T { const text = optionalString(value); return text && Object.values(values).includes(text as T) ? text as T : invalid(message); }
