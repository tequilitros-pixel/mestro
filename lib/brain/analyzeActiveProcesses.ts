import { MaestroKnowledge } from "./Knowledge";
import { getActiveProcesses } from "./data/getActiveProcesses";

type ProcessAlert = {
  source: string;
  message: string;
  level: "INFO" | "ALERTA";
};

// Referencia inicial de velocidad normal de consumo de Brix en fermentación.
// Se puede ajustar cuando tengamos más historial real de MAESTRO.
const NORMAL_BRIX_DROP_PER_HOUR = { min: 0.15, max: 0.5 };

function hoursBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

export async function analyzeActiveProcesses() {
  const { cookings, millings, fermentations, distillations } =
    await getActiveProcesses();

  const alerts: ProcessAlert[] = [];
  const recommendations: string[] = [];

  // --- Cocción ---
  for (const cooking of cookings) {
    const equipmentName = cooking.equipment?.name ?? "Horno";
    const lotCode = cooking.lot?.code ?? "";

    const hoursElapsed = hoursBetween(new Date(), cooking.startedAt);

    if (hoursElapsed > MaestroKnowledge.cooking.idealHours.max) {
      alerts.push({
        source: `${equipmentName} (${lotCode})`,
        message: `Lleva ${hoursElapsed.toFixed(1)}h de cocción, más de lo normal (${MaestroKnowledge.cooking.idealHours.max}h).`,
        level: "ALERTA",
      });
    }

    const lastTempEvent = cooking.events.find(
      (e) => e.temperature !== null && e.temperature !== undefined
    );

    if (lastTempEvent?.temperature != null) {
      if (lastTempEvent.temperature < MaestroKnowledge.cooking.minTemperatureC) {
        alerts.push({
          source: `${equipmentName} (${lotCode})`,
          message: `Temperatura baja: ${lastTempEvent.temperature}°C (mínimo esperado ${MaestroKnowledge.cooking.minTemperatureC}°C). El horno está batallando para calentar.`,
          level: "ALERTA",
        });
      }

      if (lastTempEvent.temperature > MaestroKnowledge.cooking.maxTemperatureC) {
        alerts.push({
          source: `${equipmentName} (${lotCode})`,
          message: `Temperatura alta: ${lastTempEvent.temperature}°C (máximo esperado ${MaestroKnowledge.cooking.maxTemperatureC}°C).`,
          level: "ALERTA",
        });
      }
    }
  }

  // --- Molienda ---
  for (const milling of millings) {
    const equipmentName = milling.equipment?.name ?? "Molienda";
    const lotCode = milling.lot?.code ?? "";

    if (
      milling.mashLiters != null &&
      milling.cookedKg > 0
    ) {
      const extractionEstimate =
        (milling.mashLiters / milling.cookedKg) * 100;

      if (extractionEstimate < MaestroKnowledge.milling.targetExtractionPercent) {
        recommendations.push(
          `${equipmentName} (${lotCode}): extracción baja (~${extractionEstimate.toFixed(1)}%, objetivo ${MaestroKnowledge.milling.targetExtractionPercent}%). Revisar presión de prensa o repasar bagazo.`
        );
      }
    }
  }

  // --- Fermentación ---
  for (const fermentation of fermentations) {
    const tankName = fermentation.tank;
    const lotCode = fermentation.lot?.code ?? "";
    const readings = fermentation.readings; // ya vienen ordenadas desc (más reciente primero)

    if (readings.length >= 2) {
      const [latest, previous] = readings;

      if (latest.brix != null && previous.brix != null) {
        const hours = hoursBetween(latest.createdAt, previous.createdAt);

        if (hours > 0) {
          const brixDropPerHour = (previous.brix - latest.brix) / hours;

          if (brixDropPerHour > NORMAL_BRIX_DROP_PER_HOUR.max) {
            alerts.push({
              source: `${tankName} (${lotCode})`,
              message: `Consumió Brix muy rápido: bajó ${brixDropPerHour.toFixed(2)} °Bx/h (normal hasta ${NORMAL_BRIX_DROP_PER_HOUR.max}). Revisar temperatura y actividad de la levadura.`,
              level: "ALERTA",
            });
          } else if (brixDropPerHour < NORMAL_BRIX_DROP_PER_HOUR.min && brixDropPerHour >= 0) {
            alerts.push({
              source: `${tankName} (${lotCode})`,
              message: `Fermentación lenta: bajó solo ${brixDropPerHour.toFixed(2)} °Bx/h (normal desde ${NORMAL_BRIX_DROP_PER_HOUR.min}). Verificar temperatura y levadura.`,
              level: "ALERTA",
            });
          }
        }
      }

      if (
        latest.ph != null &&
        latest.ph > MaestroKnowledge.fermentation.idealPh.max
      ) {
        alerts.push({
          source: `${tankName} (${lotCode})`,
          message: `pH elevado: ${latest.ph} (máximo ideal ${MaestroKnowledge.fermentation.idealPh.max}).`,
          level: "ALERTA",
        });
      }
    }
  }

  // --- Destilación ---
  for (const distillation of distillations) {
    const equipmentName = distillation.equipment?.name ?? "Alambique";
    const lotCode = distillation.lot?.code ?? "";

    const lastAlcoholEvent = distillation.events.find(
      (e) => e.alcohol !== null && e.alcohol !== undefined
    );

    if (lastAlcoholEvent?.alcohol != null) {
      recommendations.push(
        `${equipmentName} (${lotCode}): grado alcohólico actual ${lastAlcoholEvent.alcohol}%.`
      );
    }
  }

  return { alerts, recommendations };
}
