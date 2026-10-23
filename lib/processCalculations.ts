export function calculateAbsoluteAlcohol(liters: number, alcoholPercent: number) {
  if (liters <= 0 || alcoholPercent <= 0) return 0;

  return Number(((liters * alcoholPercent) / 100).toFixed(2));
}

/**
 * Litros de Alcohol Absoluto / Anhidro (LAA) a 20°C.
 * Estándar oficial de medición fiscal y técnica en la industria tequilera (NOM-006-SCFI / CRT).
 */
export function calculateLAA(liters: number, correctedAlcohol: number) {
  if (liters <= 0 || correctedAlcohol <= 0) return 0;

  return Number(((liters * correctedAlcohol) / 100).toFixed(2));
}

export function calculateFermentationProgress(
  initialBrix: number,
  currentBrix: number,
  targetBrix = 2
) {
  if (initialBrix <= targetBrix) return 0;

  const progress =
    ((initialBrix - currentBrix) / (initialBrix - targetBrix)) * 100;

  return Number(Math.min(100, Math.max(0, progress)).toFixed(1));
}

export function calculateMillingEfficiency(
  recoveredLiters: number,
  cookedKg: number
) {
  if (recoveredLiters <= 0 || cookedKg <= 0) return 0;

  return Number((recoveredLiters / cookedKg).toFixed(2));
}

/**
 * Calcula los kilogramos de azúcares reductores totales (ART) extraídos en molienda.
 * Considera la densidad estimada del mosto según los °Brix:
 * densidad ≈ 1 + (brix * 0.00385)
 * kgAzúcar = litros * densidad * (brix / 100)
 */
export function calculateExtractedSugarKg(liters: number, brix: number) {
  if (liters <= 0 || brix <= 0) return 0;

  const density = 1 + brix * 0.00385;
  const sugarKg = (liters * density * brix) / 100;

  return Number(sugarKg.toFixed(2));
}

/**
 * Eficiencia de extracción de azúcares respecto al contenido teórico en el agave cocido.
 * En Agave Tequilana Weber maduro el promedio de ART es ~24-28% (default: 26%).
 */
export function calculateSugarExtractionEfficiency(
  extractedSugarKg: number,
  cookedAgaveKg: number,
  theoreticalArtPercent = 26
) {
  if (extractedSugarKg <= 0 || cookedAgaveKg <= 0 || theoreticalArtPercent <= 0) return 0;

  const theoreticalSugarKg = (cookedAgaveKg * theoreticalArtPercent) / 100;
  const efficiency = (extractedSugarKg / theoreticalSugarKg) * 100;

  return Number(Math.min(100, Math.max(0, efficiency)).toFixed(1));
}

export function calculateDistillationYield(
  producedLiters: number,
  loadedLiters: number
) {
  if (producedLiters <= 0 || loadedLiters <= 0) return 0;

  return Number(((producedLiters / loadedLiters) * 100).toFixed(2));
}

/**
 * Corrección aproximada de alcohol a 20°C según variación térmica de densidad.
 * A mayor temperatura (>20°C), el alcoholímetro se hunde más marcando un grado aparente mayor,
 * por lo que se debe restar la expansión volumétrica térmica.
 */
export function calculateCorrectedAlcohol(
  observedAlcohol: number,
  temperatureC: number
) {
  if (observedAlcohol <= 0) return 0;

  const correction = (temperatureC - 20) * 0.18;
  const corrected = observedAlcohol - correction;

  return Math.max(0, Number(corrected.toFixed(2)));
}

export type FermentationDiagnostic = {
  status: "EN_ARRANQUE" | "ACTIVA" | "LENTA" | "ESTANCADA" | "TERMINADA";
  consumptionRateBxPerHour: number | null;
  message: string;
  recommendation: string;
  isStuckRisk: boolean;
};

/**
 * Analizador cinético de fermentación tequilera.
 * Detecta fermentaciones lentas o atascadas (stuck fermentations) evaluando
 * la velocidad de atenuación de azúcares (ΔBrix / Δt) y condiciones de pH/temperatura.
 */
export function analyzeFermentationKinetics(
  readings: Array<{
    createdAt: Date | string;
    brix: number | null;
    alcohol?: number | null;
    ph?: number | null;
    temperature?: number | null;
  }>
): FermentationDiagnostic {
  const validBrix = readings
    .filter((r) => r.brix !== null && r.brix !== undefined)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (validBrix.length === 0) {
    return {
      status: "EN_ARRANQUE",
      consumptionRateBxPerHour: null,
      message: "Sin lecturas suficientes de °Brix.",
      recommendation: "Registra la primera lectura de °Brix tras la inoculación de levadura.",
      isStuckRisk: false,
    };
  }

  const latest = validBrix[validBrix.length - 1];
  const latestBrix = latest.brix!;

  if (latestBrix <= 2.0) {
    return {
      status: "TERMINADA",
      consumptionRateBxPerHour: 0,
      message: `Fermentación concluida con éxito (${latestBrix.toFixed(1)} °Bx).`,
      recommendation: "El mosto está listo para ser enviado a destilación inmediata y evitar acescencia.",
      isStuckRisk: false,
    };
  }

  if (validBrix.length === 1) {
    return {
      status: "EN_ARRANQUE",
      consumptionRateBxPerHour: null,
      message: `En fase de latencia / inicio (${latestBrix.toFixed(1)} °Bx).`,
      recommendation: "Monitorea la temperatura (óptimo 28-34°C) para favorecer la multiplicación celular.",
      isStuckRisk: false,
    };
  }

  // Calcular la velocidad entre las últimas 2 lecturas o el intervalo reciente
  const prev = validBrix[validBrix.length - 2];
  const deltaHours =
    (new Date(latest.createdAt).getTime() - new Date(prev.createdAt).getTime()) / (1000 * 60 * 60);

  if (deltaHours <= 0.1) {
    return {
      status: "ACTIVA",
      consumptionRateBxPerHour: null,
      message: `Fermentando a ${latestBrix.toFixed(1)} °Bx.`,
      recommendation: "Continúa el monitoreo periódico.",
      isStuckRisk: false,
    };
  }

  const deltaBrix = prev.brix! - latest.brix!;
  const rateBxPerHour = Number((deltaBrix / deltaHours).toFixed(2));

  // Si pasaron más de 8 horas y el Brix no bajó casi nada
  if (deltaHours >= 6 && deltaBrix < 0.2 && latestBrix > 3.0) {
    return {
      status: "ESTANCADA",
      consumptionRateBxPerHour: rateBxPerHour,
      message: `Alerta: Fermentación atascada (consumo crítico de ${rateBxPerHour} °Bx/h con ${latestBrix.toFixed(1)} °Bx remanentes).`,
      recommendation: "Verifica si la temperatura superó los 38°C (muerte térmica de levadura) o pH < 3.5. Considera aireación leve o reinoculación de pie de cuba.",
      isStuckRisk: true,
    };
  }

  if (rateBxPerHour < 0.15 && deltaHours >= 4 && latestBrix > 3.0) {
    return {
      status: "LENTA",
      consumptionRateBxPerHour: rateBxPerHour,
      message: `Fermentación lenta (${rateBxPerHour} °Bx/h).`,
      recommendation: "Verifica temperatura y nutrientes (sulfato de amonio / sales de nitrógeno) para reactivar la cinetica.",
      isStuckRisk: true,
    };
  }

  return {
    status: "ACTIVA",
    consumptionRateBxPerHour: rateBxPerHour,
    message: `Fermentación activa con ritmo óptimo de ${rateBxPerHour} °Bx/hora.`,
    recommendation: "El consumo de azúcares evoluciona favorablemente dentro del perfil esperado.",
    isStuckRisk: false,
  };
}

/**
 * Calcula métricas de consumo de vapor y eficiencia térmica en cocimiento.
 */
export function calculateSteamEnergyMetrics(
  intervals: Array<{
    startedAt: Date | string;
    endedAt: Date | string | null;
    state: string;
  }>,
  agaveKg: number
) {
  let injectionMillis = 0;
  let restMillis = 0;

  intervals.forEach((interval) => {
    const start = new Date(interval.startedAt).getTime();
    const end = interval.endedAt ? new Date(interval.endedAt).getTime() : Date.now();
    const duration = Math.max(0, end - start);

    if (interval.state === "INYECTANDO") {
      injectionMillis += duration;
    } else {
      restMillis += duration;
    }
  });

  const injectionHours = Number((injectionMillis / (1000 * 60 * 60)).toFixed(2));
  const restHours = Number((restMillis / (1000 * 60 * 60)).toFixed(2));
  const agaveTons = agaveKg > 0 ? agaveKg / 1000 : 0;
  const hoursPerTon = agaveTons > 0 ? Number((injectionHours / agaveTons).toFixed(2)) : 0;

  return {
    injectionHours,
    restHours,
    agaveTons: Number(agaveTons.toFixed(2)),
    hoursPerTon,
  };
}

/**
 * Estructura de Costeo Basado en Actividades (ABC) y valoración del Inventario en Proceso (WIP).
 */
export function calculateStageCostsAndWIP(
  expenses: Array<{ category: string; amount: number }>,
  currentLotStage: string
) {
  const STAGE_CATEGORIES: Record<string, string[]> = {
    "RECEPCION": ["Materia prima", "Transporte"],
    "COCCION": ["Cocción"],
    "MOLIENDA": ["Molienda"],
    "FERMENTACION": ["Fermentación"],
    "DESTILACION": ["Destilación"],
    "ENVASADO": ["Envasado"],
    "GENERAL": ["Mano de obra", "Otros"],
  };

  const stageTotals: Record<string, number> = {
    "RECEPCION": 0,
    "COCCION": 0,
    "MOLIENDA": 0,
    "FERMENTACION": 0,
    "DESTILACION": 0,
    "ENVASADO": 0,
    "GENERAL": 0,
  };

  expenses.forEach((e) => {
    let matched = false;
    for (const [stage, categories] of Object.entries(STAGE_CATEGORIES)) {
      if (categories.includes(e.category)) {
        stageTotals[stage] += e.amount;
        matched = true;
        break;
      }
    }
    if (!matched) stageTotals["GENERAL"] += e.amount;
  });

  const totalCost = Object.values(stageTotals).reduce((sum, val) => sum + val, 0);

  return {
    stageTotals,
    totalCost,
    currentLotStage,
  };
}
