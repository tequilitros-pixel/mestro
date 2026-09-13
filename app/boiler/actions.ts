"use server";

import { BoilerEventType, BoilerSource, GasReadingType, PressureUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireModuleActionAccess } from "@/lib/auth";
import { createBoilerEvent, createBoilerIncident, createBoilerMaintenance, createGasReading, createPressureReading, startBoilerSession, stopBoilerSession } from "@/lib/boiler/service";

const text = (form: FormData, key: string) => { const value = form.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; };
const required = (form: FormData, key: string) => text(form, key) ?? (() => { throw new Error(`Falta ${key}`); })();
const number = (form: FormData, key: string) => { const value = Number(required(form, key)); if (!Number.isFinite(value)) throw new Error(`Valor inválido: ${key}`); return value; };
const source = (form: FormData) => (text(form, "source") as BoilerSource | null) ?? BoilerSource.MANUAL;
const revalidate = (equipmentId?: string) => { revalidatePath("/boiler"); revalidatePath("/plant"); if (equipmentId) revalidatePath(`/boiler/${equipmentId}`); };

export async function startBoilerSessionAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  const equipmentId = required(form, "equipmentId");
  await startBoilerSession({ operationId: crypto.randomUUID(), equipmentId, actorId: user.id, occurredAt: text(form, "occurredAt") ?? undefined, source: source(form), initialGasPercent: text(form, "initialGasPercent") ? number(form, "initialGasPercent") : null, notes: text(form, "notes") });
  revalidate(equipmentId);
}

export async function stopBoilerSessionAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  const sessionId = required(form, "sessionId");
  await stopBoilerSession({ operationId: crypto.randomUUID(), sessionId, actorId: user.id, occurredAt: text(form, "occurredAt") ?? undefined, source: source(form), closeReason: text(form, "closeReason") });
  revalidate();
}

export async function createGasReadingAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  await createGasReading({ operationId: crypto.randomUUID(), sessionId: required(form, "sessionId"), actorId: user.id, percent: number(form, "percent"), type: (text(form, "type") as GasReadingType) ?? GasReadingType.CHECK, occurredAt: text(form, "occurredAt") ?? undefined, source: source(form), notes: text(form, "notes") });
  revalidate();
}

export async function createBoilerEventAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  await createBoilerEvent({ operationId: crypto.randomUUID(), sessionId: text(form, "sessionId"), actorId: user.id, type: required(form, "type") as BoilerEventType, occurredAt: text(form, "occurredAt") ?? undefined, source: source(form), notes: text(form, "notes") });
  revalidate();
}

export async function createBoilerPressureAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  await createPressureReading({ operationId: crypto.randomUUID(), sessionId: required(form, "sessionId"), intervalId: text(form, "intervalId"), actorId: user.id, value: number(form, "value"), unit: required(form, "unit") as PressureUnit, occurredAt: text(form, "occurredAt") ?? undefined, source: source(form), notes: text(form, "notes") });
  revalidate();
}

export async function createBoilerMaintenanceAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  const equipmentId = required(form, "equipmentId");
  await createBoilerMaintenance({ operationId: crypto.randomUUID(), equipmentId, actorId: user.id, notes: required(form, "notes"), source: source(form) });
  revalidate(equipmentId);
}

export async function createBoilerIncidentAction(form: FormData) {
  const user = await requireModuleActionAccess("/boiler");
  const equipmentId = required(form, "equipmentId");
  await createBoilerIncident({ operationId: crypto.randomUUID(), equipmentId, sessionId: text(form, "sessionId"), actorId: user.id, notes: required(form, "notes"), source: source(form) });
  revalidate(equipmentId);
}
