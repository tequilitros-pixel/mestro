import "server-only";
import { Prisma, BoilerEventType, BoilerSource, EquipmentType, GasReadingType, LotStage, PressureUnit, SteamInjectionState, CookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gasPercentToLiters, pressureToPsi } from "./units";

export class BoilerDomainError extends Error {
  constructor(message: string, readonly code = "VALIDATION_ERROR") { super(message); }
}

type Db = typeof prisma;
type Tx = Prisma.TransactionClient | Db;
const invalid = (message: string, code?: string): never => { throw new BoilerDomainError(message, code); };
const date = (value: Date | string) => { const result = value instanceof Date ? value : new Date(value); return Number.isNaN(result.getTime()) ? invalid("Fecha inválida") : result; };
const decimal = (value: Prisma.Decimal.Value, label: string) => { try { const result = new Prisma.Decimal(value); return result.isFinite() ? result : invalid(`${label} inválido`); } catch { return invalid(`${label} inválido`); } };
const nonNegative = (value: Prisma.Decimal, label: string) => value.gte(0) ? value : invalid(`${label} no puede ser negativo`);

async function ensureCaldera(tx: Tx, equipmentId: string) {
  const equipment = await tx.equipment.findUnique({ where: { id: equipmentId }, select: { id: true, type: true, active: true } });
  if (!equipment || equipment.type !== EquipmentType.CALDERA || !equipment.active) invalid("El equipo no es una Caldera activa", "EQUIPMENT_INVALID");
  return equipment;
}

export async function startBoilerSession(input: { operationId: string; equipmentId: string; actorId: string; occurredAt?: Date | string; source?: BoilerSource; initialGasPercent?: Prisma.Decimal.Value | null; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.boilerSession.findUnique({ where: { operationId: input.operationId } });
    if (previous) return previous;
    await ensureCaldera(tx, input.equipmentId);
    const startedAt = date(input.occurredAt ?? new Date());
    const session = await tx.boilerSession.create({ data: { operationId: input.operationId, equipmentId: input.equipmentId, startedAt, startedById: input.actorId, source: input.source ?? BoilerSource.MANUAL } });
    await tx.boilerEvent.create({ data: { operationId: `${input.operationId}:encendido`, sessionId: session.id, type: BoilerEventType.ENCENDIDO, occurredAt: startedAt, actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
    if (input.initialGasPercent !== null && input.initialGasPercent !== undefined) {
      const percent = nonNegative(decimal(input.initialGasPercent, "Porcentaje de gas"), "Porcentaje de gas");
      if (percent.gt(100)) invalid("El porcentaje de gas debe estar entre 0 y 100");
      await tx.gasReading.create({ data: { operationId: `${input.operationId}:gas`, boilerSessionId: session.id, levelPercent: percent, levelLiters: gasPercentToLiters(percent), type: GasReadingType.INITIAL, occurredAt: startedAt, actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL } });
    }
    return session;
  });
}

export async function stopBoilerSession(input: { operationId: string; sessionId: string; actorId: string; occurredAt?: Date | string; source?: BoilerSource; closeReason?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.boilerSession.findUnique({ where: { stopOperationId: input.operationId } });
    if (existing) return existing;
    const session = await tx.boilerSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new BoilerDomainError("Sesión de Caldera no encontrada", "SESSION_NOT_FOUND");
    if (session.endedAt) invalid("La sesión de Caldera ya está cerrada", "SESSION_CLOSED");
    const endedAt = date(input.occurredAt ?? new Date());
    if (endedAt < session.startedAt) invalid("El cierre no puede ser anterior al encendido");
    const updated = await tx.boilerSession.update({ where: { id: session.id }, data: { endedAt, endedById: input.actorId, stopOperationId: input.operationId, closeReason: input.closeReason ?? null } });
    await tx.boilerEvent.create({ data: { operationId: `${input.operationId}:apagado`, sessionId: session.id, type: input.closeReason ? BoilerEventType.CIERRE_FORZADO : BoilerEventType.APAGADO, occurredAt: endedAt, actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.closeReason ?? null } });
    await tx.steamInjectionInterval.updateMany({ where: { boilerSessionId: session.id, endedAt: null }, data: { endedAt } });
    await tx.boilerProcessLink.updateMany({ where: { boilerSessionId: session.id, endedAt: null }, data: { endedAt } });
    return updated;
  });
}

export async function createBoilerEvent(input: { operationId: string; sessionId?: string | null; type: BoilerEventType; actorId: string; occurredAt?: Date | string; source?: BoilerSource; notes?: string | null; metadata?: Prisma.InputJsonValue }) {
  return prisma.boilerEvent.upsert({ where: { operationId: input.operationId }, update: {}, create: { operationId: input.operationId, sessionId: input.sessionId ?? null, type: input.type, actorId: input.actorId, occurredAt: date(input.occurredAt ?? new Date()), source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null, metadata: input.metadata } });
}

export async function createBoilerMaintenance(input: { operationId: string; equipmentId: string; actorId: string; notes: string; occurredAt?: Date | string; source?: BoilerSource }) {
  await ensureCaldera(prisma, input.equipmentId);
  return prisma.boilerMaintenance.upsert({ where: { operationId: input.operationId }, update: {}, create: { operationId: input.operationId, equipmentId: input.equipmentId, actorId: input.actorId, notes: input.notes, occurredAt: date(input.occurredAt ?? new Date()), source: input.source ?? BoilerSource.MANUAL } });
}

export async function createBoilerIncident(input: { operationId: string; equipmentId: string; actorId: string; sessionId?: string | null; notes: string; occurredAt?: Date | string; source?: BoilerSource }) {
  await ensureCaldera(prisma, input.equipmentId);
  return prisma.boilerIncident.upsert({ where: { operationId: input.operationId }, update: {}, create: { operationId: input.operationId, equipmentId: input.equipmentId, sessionId: input.sessionId ?? null, actorId: input.actorId, notes: input.notes, occurredAt: date(input.occurredAt ?? new Date()), source: input.source ?? BoilerSource.MANUAL } });
}

export async function createGasReading(input: { operationId: string; sessionId: string; actorId: string; percent: Prisma.Decimal.Value; type: GasReadingType; occurredAt?: Date | string; source?: BoilerSource; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.gasReading.findUnique({ where: { operationId: input.operationId } });
    if (existing) return existing;
    const session = await tx.boilerSession.findUnique({ where: { id: input.sessionId }, include: { gasReadings: { orderBy: { occurredAt: "desc" }, take: 1 } } });
    if (!session) throw new BoilerDomainError("Sesión de Caldera no encontrada", "SESSION_NOT_FOUND");
    if (session.endedAt) invalid("No se puede registrar gas en una sesión cerrada", "SESSION_CLOSED");
    const percent = nonNegative(decimal(input.percent, "Porcentaje de gas"), "Porcentaje de gas");
    if (percent.gt(100)) invalid("El porcentaje de gas debe estar entre 0 y 100");
    const previous = session.gasReadings[0];
    const type = previous && percent.gt(previous.levelPercent) ? GasReadingType.REFILL : input.type;
    return tx.gasReading.create({ data: { operationId: input.operationId, boilerSessionId: input.sessionId, levelPercent: percent, levelLiters: gasPercentToLiters(percent), type, occurredAt: date(input.occurredAt ?? new Date()), actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
  });
}

async function ensureCooking(tx: Tx, cookingId: string) {
  const cooking = await tx.cooking.findUnique({ where: { id: cookingId }, select: { id: true, lotId: true, status: true, closureCode: true } });
  if (!cooking) throw new BoilerDomainError("Cocción no encontrada", "COOKING_NOT_FOUND");
  if (cooking.status === CookingStatus.TERMINADA || cooking.closureCode) invalid("La cocción ya está cerrada", "COOKING_CLOSED");
  return cooking;
}

async function openBoiler(tx: Tx, sessionId?: string) {
  const session = sessionId ? await tx.boilerSession.findUnique({ where: { id: sessionId } }) : await tx.boilerSession.findFirst({ where: { endedAt: null, equipment: { type: EquipmentType.CALDERA, active: true } }, orderBy: { startedAt: "desc" } });
  if (!session) throw new BoilerDomainError("No hay una sesión activa de Caldera", "NO_ACTIVE_BOILER");
  if (session.endedAt) invalid("La sesión de Caldera ya está cerrada", "SESSION_CLOSED");
  return session;
}

export async function startSteamInterval(input: { operationId: string; cookingId: string; boilerSessionId?: string; actorId: string; pressureValue: Prisma.Decimal.Value; pressureUnit: PressureUnit; occurredAt?: Date | string; source?: BoilerSource; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.steamInjectionInterval.findUnique({ where: { startOperationId: input.operationId } });
    if (previous) return previous;
    const cooking = await ensureCooking(tx, input.cookingId);
    const session = await openBoiler(tx, input.boilerSessionId);
    const active = await tx.steamInjectionInterval.findFirst({ where: { cookingId: cooking.id, endedAt: null }, orderBy: { startedAt: "desc" } });
    const startedAt = date(input.occurredAt ?? new Date());
    if (active?.state === SteamInjectionState.INYECTANDO) invalid("El vapor ya está activo", "STEAM_ALREADY_ACTIVE");
    if (active) await tx.steamInjectionInterval.update({ where: { id: active.id }, data: { endedAt: startedAt, stopOperationId: `${input.operationId}:close-idle` } });
    const interval = await tx.steamInjectionInterval.create({ data: { startOperationId: input.operationId, cookingId: cooking.id, boilerSessionId: session.id, state: SteamInjectionState.INYECTANDO, startedAt, createdById: input.actorId, source: input.source ?? BoilerSource.MANUAL } });
    await tx.pressureReading.create({ data: { operationId: `${input.operationId}:pressure`, steamIntervalId: interval.id, boilerSessionId: session.id, originalValue: nonNegative(decimal(input.pressureValue, "Presión"), "Presión"), originalUnit: input.pressureUnit, canonicalPsi: pressureToPsi(input.pressureValue, input.pressureUnit), occurredAt: startedAt, actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
    const link = await tx.boilerProcessLink.findFirst({ where: { boilerSessionId: session.id, processId: cooking.id, endedAt: null } });
    if (!link) await tx.boilerProcessLink.create({ data: { boilerSessionId: session.id, lotId: cooking.lotId, stage: LotStage.COCCION, processType: "COCIMIENTO", processId: cooking.id, startedAt, createdById: input.actorId, source: input.source ?? BoilerSource.MANUAL } });
    await tx.boilerEvent.create({ data: { operationId: `${input.operationId}:event`, sessionId: session.id, type: BoilerEventType.VAPOR_INICIADO, occurredAt: startedAt, actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
    return interval;
  });
}

export async function createPressureReading(input: { operationId: string; sessionId: string; intervalId?: string | null; actorId: string; value: Prisma.Decimal.Value; unit: PressureUnit; occurredAt?: Date | string; source?: BoilerSource; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pressureReading.findUnique({ where: { operationId: input.operationId } });
    if (existing) return existing;
    const session = await openBoiler(tx, input.sessionId);
    const value = nonNegative(decimal(input.value, "Presión"), "Presión");
    if (input.intervalId) {
      const interval = await tx.steamInjectionInterval.findUnique({ where: { id: input.intervalId } });
      if (!interval || interval.boilerSessionId !== session.id) invalid("Intervalo de vapor inválido");
    }
    return tx.pressureReading.create({ data: { operationId: input.operationId, steamIntervalId: input.intervalId ?? undefined, boilerSessionId: session.id, originalValue: value, originalUnit: input.unit, canonicalPsi: pressureToPsi(value, input.unit), occurredAt: date(input.occurredAt ?? new Date()), actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
  });
}

export async function stopSteamInterval(input: { operationId: string; cookingId: string; actorId: string; occurredAt?: Date | string; source?: BoilerSource; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.steamInjectionInterval.findUnique({ where: { stopOperationId: input.operationId } });
    if (previous) return previous;
    const cooking = await ensureCooking(tx, input.cookingId);
    const active = await tx.steamInjectionInterval.findFirst({ where: { cookingId: cooking.id, state: SteamInjectionState.INYECTANDO, endedAt: null }, orderBy: { startedAt: "desc" } });
    if (!active) throw new BoilerDomainError("No hay vapor activo", "STEAM_NOT_ACTIVE");
    const endedAt = date(input.occurredAt ?? new Date());
    const closed = await tx.steamInjectionInterval.update({ where: { id: active.id }, data: { endedAt, stopOperationId: input.operationId } });
    await tx.steamInjectionInterval.create({ data: { startOperationId: `${input.operationId}:sin-inyeccion`, cookingId: cooking.id, boilerSessionId: active.boilerSessionId, state: SteamInjectionState.SIN_INYECCION, startedAt: endedAt, createdById: input.actorId, source: input.source ?? BoilerSource.MANUAL } });
    await tx.boilerEvent.create({ data: { operationId: `${input.operationId}:event`, sessionId: active.boilerSessionId, type: BoilerEventType.VAPOR_DETENIDO, occurredAt: endedAt, actorId: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
    return closed;
  });
}

export async function createSweetHoneyRecovery(input: { operationId: string; lotId: string; sourceCookingId: string; destinationTankId?: string | null; liters: Prisma.Decimal.Value; brix?: Prisma.Decimal.Value | null; actorId: string; recoveredAt?: Date | string; source?: BoilerSource; notes?: string | null }) {
  const liters = nonNegative(decimal(input.liters, "Litros de miel dulce"), "Litros de miel dulce");
  if (liters.lte(0)) invalid("Los litros de miel dulce deben ser mayores a cero");
  const brix = input.brix === null || input.brix === undefined ? null : nonNegative(decimal(input.brix, "°Brix"), "°Brix");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sweetHoneyRecovery.findUnique({ where: { operationId: input.operationId } });
    if (existing) return existing;
    const cooking = await tx.cooking.findUnique({ where: { id: input.sourceCookingId }, select: { lotId: true } });
    if (!cooking || cooking.lotId !== input.lotId) invalid("La cocción no pertenece al lote indicado");
    if (input.destinationTankId) {
      const tank = await tx.equipment.findUnique({ where: { id: input.destinationTankId }, select: { type: true, active: true } });
      if (!tank || tank.type !== EquipmentType.TINA || !tank.active) invalid("El tanque destino no es una tina activa");
    }
    return tx.sweetHoneyRecovery.create({ data: { operationId: input.operationId, lotId: input.lotId, sourceCookingId: input.sourceCookingId, destinationTankId: input.destinationTankId ?? null, liters, brix, recoveredAt: date(input.recoveredAt ?? new Date()), createdById: input.actorId, source: input.source ?? BoilerSource.MANUAL, notes: input.notes ?? null } });
  });
}
