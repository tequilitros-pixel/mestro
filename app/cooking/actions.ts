"use server";

import { BoilerSource, PressureUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireModuleActionAccess } from "@/lib/auth";
import { createPressureReading, createSweetHoneyRecovery, startSteamInterval, stopSteamInterval } from "@/lib/boiler/service";

const text = (form: FormData, key: string) => { const value = form.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; };
const required = (form: FormData, key: string) => text(form, key) ?? (() => { throw new Error(`Falta ${key}`); })();
const number = (form: FormData, key: string) => { const value = Number(required(form, key)); if (!Number.isFinite(value)) throw new Error(`Valor inválido: ${key}`); return value; };
const source = (form: FormData) => (text(form, "source") as BoilerSource | null) ?? BoilerSource.MANUAL;
const refresh = (id: string) => { revalidatePath(`/cooking/${id}`); revalidatePath("/boiler"); };

export async function startSteamAction(cookingId: string, form: FormData) {
  const user = await requireModuleActionAccess("/cooking");
  await startSteamInterval({ operationId: crypto.randomUUID(), cookingId, boilerSessionId: text(form, "boilerSessionId") ?? undefined, actorId: user.id, pressureValue: number(form, "pressureValue"), pressureUnit: required(form, "pressureUnit") as PressureUnit, source: source(form), notes: text(form, "notes") });
  refresh(cookingId);
}

export async function changeSteamPressureAction(cookingId: string, form: FormData) {
  const user = await requireModuleActionAccess("/cooking");
  await createPressureReading({ operationId: crypto.randomUUID(), sessionId: required(form, "boilerSessionId"), intervalId: required(form, "intervalId"), actorId: user.id, value: number(form, "pressureValue"), unit: required(form, "pressureUnit") as PressureUnit, source: source(form), notes: text(form, "notes") });
  refresh(cookingId);
}

export async function stopSteamAction(cookingId: string, form: FormData) {
  const user = await requireModuleActionAccess("/cooking");
  await stopSteamInterval({ operationId: crypto.randomUUID(), cookingId, actorId: user.id, source: source(form), notes: text(form, "notes") });
  refresh(cookingId);
}

export async function createSweetHoneyRecoveryAction(cookingId: string, form: FormData) {
  const user = await requireModuleActionAccess("/cooking");
  await createSweetHoneyRecovery({ operationId: crypto.randomUUID(), lotId: required(form, "lotId"), sourceCookingId: cookingId, destinationTankId: text(form, "destinationTankId"), liters: number(form, "liters"), brix: text(form, "brix") ? number(form, "brix") : null, actorId: user.id, source: source(form), notes: text(form, "notes") });
  refresh(cookingId);
}
