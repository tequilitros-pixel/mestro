import { DistillationEvent } from "@prisma/client";
import {
  calculateCorrectedAlcohol,
  calculateAbsoluteAlcohol,
  calculateDistillationYield,
} from "../processCalculations";

export function getCurrentAlcohol(events: DistillationEvent[]) {
  const alcohol = [...events]
    .reverse()
    .find((e) => e.alcohol !== null);

  return alcohol?.alcohol ?? null;
}

export function getCurrentTemperature(events: DistillationEvent[]) {
  const temp = [...events]
    .reverse()
    .find((e) => e.temperature !== null);

  return temp?.temperature ?? null;
}

export function getTotalLiters(events: DistillationEvent[]) {
  return events.reduce((sum, event) => {
    return sum + (event.liters ?? 0);
  }, 0);
}

export function getHeartLiters(events: DistillationEvent[]) {
  let total = 0;
  let counting = false;

  for (const event of events) {
    if (event.type === "INICIO_CORAZON") counting = true;

    if (counting) {
      total += event.liters ?? 0;
    }

    if (event.type === "FIN_CORAZON") break;
  }

  return total;
}

export function getHeadsLiters(events: DistillationEvent[]) {
  let total = 0;

  for (const event of events) {
    if (event.type === "CORTE_CABEZAS") {
      total += event.liters ?? 0;
    }
  }

  return total;
}

export function getTailLiters(events: DistillationEvent[]) {
  let total = 0;
  let counting = false;

  for (const event of events) {
    if (event.type === "INICIO_COLAS") counting = true;

    if (counting) {
      total += event.liters ?? 0;
    }
  }

  return total;
}

export function getCorrectedAlcohol(
  alcohol: number | null,
  temperature: number | null
) {
  if (alcohol === null || temperature === null) return null;

  return calculateCorrectedAlcohol(alcohol, temperature);
}

export function getAbsoluteAlcohol(
  liters: number,
  correctedAlcohol: number | null
) {
  if (correctedAlcohol === null) return null;

  return calculateAbsoluteAlcohol(liters, correctedAlcohol);
}

export function getYield(
  loadedLiters: number,
  producedLiters: number
) {
  return calculateDistillationYield(
    loadedLiters,
    producedLiters
  );
}
export function getDistillationStatus(events: DistillationEvent[]) {
  if (events.some((e) => e.type === "FIN_DESTILACION")) return "🏁 Finalizada";
  if (events.some((e) => e.type === "INICIO_COLAS")) return "🟤 En colas";
  if (events.some((e) => e.type === "FIN_CORAZON")) return "🟤 Terminando corazón";
  if (events.some((e) => e.type === "INICIO_CORAZON")) return "❤️ En corazón";
  if (events.some((e) => e.type === "CORTE_CABEZAS")) return "🥃 Sacando destrozado";
  if (events.some((e) => e.type === "INICIO_CALENTAMIENTO")) return "🔥 Calentando";

  return "⏳ Sin iniciar";
}