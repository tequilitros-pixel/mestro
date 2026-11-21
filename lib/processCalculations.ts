export function calculateAbsoluteAlcohol(liters: number, alcoholPercent: number) {
  if (liters <= 0 || alcoholPercent <= 0) return 0;

  return Number(((liters * alcoholPercent) / 100).toFixed(2));
}

/**
 * Litros de Alcohol Absoluto / Anhidro (LAA) a 20 °C, calculados a partir de
 * una graduación que ya fue corregida con el procedimiento aplicable.
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
      message: `°Brix bajo registrado (${latestBrix.toFixed(1)} °Bx).`,
      recommendation: "Confirma el cierre con el protocolo de planta antes de transferir a destilación.",
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
      recommendation: "Verifica temperatura, pH y el protocolo de planta; escala la evaluación al responsable técnico antes de intervenir.",
      isStuckRisk: true,
    };
  }

  if (rateBxPerHour < 0.15 && deltaHours >= 4 && latestBrix > 3.0) {
    return {
      status: "LENTA",
      consumptionRateBxPerHour: rateBxPerHour,
      message: `Fermentación lenta (${rateBxPerHour} °Bx/h).`,
      recommendation: "Verifica temperatura, pH y condiciones del proceso con el responsable técnico antes de realizar ajustes.",
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
    "RECEPCION": ["Materia prima", "Transporte", "Agave", "Flete", "Jima"],
    "COCCION": ["Cocción", "Cocimiento", "Gas", "Caldera"],
    "MOLIENDA": ["Molienda", "Agua"],
    "FERMENTACION": ["Fermentación", "Levadura", "Nutrientes"],
    "DESTILACION": ["Destilación", "Alambique"],
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

/**
 * Proyección teórica de rendimiento tequilero a partir de kg de agave y % ART.
 * En la industria tequilera (NOM-006-SCFI-2012):
 * - Azúcares Reductores Totales (ART) típicos: 24% a 28% (promedio 26%).
 * - Conversión estequiométrica Gay-Lussac: 1 kg glucosa/fructosa -> 0.511 kg etanol.
 * - Rendimiento práctico industrial (extracción ~90%, fermentación ~88%, destilación ~95%):
 *   aprox. 7.0 a 8.5 kg de agave por cada litro de Tequila a 40% Alc. Vol.
 */
export function calculateTheoreticalTequilaYield(
  agaveKg: number,
  artPercent?: number | null
) {
  if (agaveKg <= 0) {
    return {
      estimatedSugarKg: 0,
      theoreticalLAALiters: 0,
      theoreticalTequila40Liters: 0,
      expectedKgPerLiter: 0,
      artUsed: 0,
    };
  }

  const art = artPercent && artPercent > 0 ? artPercent : 26;
  const totalAgaveSugarKg = (agaveKg * art) / 100;

  // Factor de conversión industrial calibrado: 1,000 kg de agave a 26% ART rinden ~135 L de Tequila a 40% Alc. Vol. (~7.4 kg/L)
  const baseYieldFactor = 0.135;
  const adjustedYieldFactor = baseYieldFactor * (art / 26);

  const theoreticalTequila40Liters = Number((agaveKg * adjustedYieldFactor).toFixed(1));
  const theoreticalLAALiters = Number((theoreticalTequila40Liters * 0.40).toFixed(1));
  const expectedKgPerLiter = theoreticalTequila40Liters > 0
    ? Number((agaveKg / theoreticalTequila40Liters).toFixed(2))
    : 0;

  return {
    estimatedSugarKg: Number(totalAgaveSugarKg.toFixed(1)),
    theoreticalLAALiters,
    theoreticalTequila40Liters,
    expectedKgPerLiter,
    artUsed: art,
  };
}

/**
 * Balance de masa y azúcares en cocimiento de agave.
 */
export function calculateCookingYield(
  agaveKg: number,
  finalAgaveKg: number | null,
  sweetHoneyLiters?: number | null,
  sweetHoneyBrix?: number | null
) {
  const cookedKg = finalAgaveKg ?? agaveKg;
  const weightLossKg = Math.max(0, agaveKg - cookedKg);
  const weightLossPercent = agaveKg > 0 ? Number(((weightLossKg / agaveKg) * 100).toFixed(1)) : 0;
  const honeyLiters = sweetHoneyLiters ?? 0;
  const honeyBrix = sweetHoneyBrix ?? 0;
  const sweetHoneySugarKg = calculateExtractedSugarKg(honeyLiters, honeyBrix);

  return {
    rawAgaveKg: agaveKg,
    cookedAgaveKg: cookedKg,
    weightLossKg,
    weightLossPercent,
    sweetHoneyLiters: honeyLiters,
    sweetHoneyBrix: honeyBrix,
    sweetHoneySugarKg,
  };
}

/**
 * Fraccionamiento y balance de LAA en destilación (Cabezas, Corazón y Colas).
 */
export function calculateDistillationFractionation(
  headsLiters: number,
  headsAlcohol: number,
  heartLiters: number,
  heartAlcohol: number,
  tailsLiters: number,
  tailsAlcohol: number
) {
  const totalLiters = headsLiters + heartLiters + tailsLiters;

  const laaHeads = calculateLAA(headsLiters, headsAlcohol);
  const laaHeart = calculateLAA(heartLiters, heartAlcohol);
  const laaTails = calculateLAA(tailsLiters, tailsAlcohol);
  const totalLAA = Number((laaHeads + laaHeart + laaTails).toFixed(2));

  const headsVolPercent = totalLiters > 0 ? Number(((headsLiters / totalLiters) * 100).toFixed(1)) : 0;
  const heartVolPercent = totalLiters > 0 ? Number(((heartLiters / totalLiters) * 100).toFixed(1)) : 0;
  const tailsVolPercent = totalLiters > 0 ? Number(((tailsLiters / totalLiters) * 100).toFixed(1)) : 0;

  const heartLAAPercent = totalLAA > 0 ? Number(((laaHeart / totalLAA) * 100).toFixed(1)) : 0;

  return {
    totalLiters: Number(totalLiters.toFixed(1)),
    totalLAA,
    heads: { liters: headsLiters, alcohol: headsAlcohol, laa: laaHeads, volPercent: headsVolPercent },
    heart: { liters: heartLiters, alcohol: heartAlcohol, laa: laaHeart, volPercent: heartVolPercent, laaPercent: heartLAAPercent },
    tails: { liters: tailsLiters, alcohol: tailsAlcohol, laa: laaTails, volPercent: tailsVolPercent },
  };
}

/**
 * Balance maestro integral del lote de producción tequilera.
 */
export function calculateLotMasterBalance(input: {
  agaveKg: number;
  art?: number | null;
  totalLitersObtained?: number | null;
  totalCost: number;
  cookings: Array<{
    agaveKg: number;
    finalAgaveKg: number | null;
    finalSweetHoneyLiters: number | null;
    finalSweetHoneyBrix: number | null;
    status: string;
  }>;
  millings: Array<{
    cookedKg: number;
    mashLiters: number | null;
    finalMashLiters: number | null;
    brix: number | null;
    finalAverageBrix: number | null;
    status: string;
  }>;
  fermentations: Array<{
    mustLiters: number;
    initialBrix: number;
    finalBrix: number | null;
    finalAlcohol: number | null;
    status: string;
  }>;
  distillations: Array<{
    type: string;
    loadedLiters: number;
    finalLiters: number | null;
    finalAlcohol: number | null;
    heartLiters: number | null;
    status: string;
  }>;
}) {
  const { agaveKg, art, totalLitersObtained, totalCost, cookings, millings, fermentations, distillations } = input;

  const theoretical = calculateTheoreticalTequilaYield(agaveKg, art);
  const actualLiters = totalLitersObtained ?? 0;
  const actualKgPerLiter = actualLiters > 0 ? Number((agaveKg / actualLiters).toFixed(2)) : null;
  const actualCostPerLiter = actualLiters > 0 ? Number((totalCost / actualLiters).toFixed(2)) : 0;

  // Azúcares extraídos en molienda
  let totalMashLiters = 0;
  let totalExtractedSugarKg = 0;
  millings.forEach((m) => {
    const liters = m.finalMashLiters ?? m.mashLiters ?? 0;
    const bx = m.finalAverageBrix ?? m.brix ?? 0;
    totalMashLiters += liters;
    totalExtractedSugarKg += calculateExtractedSugarKg(liters, bx);
  });

  const extractionEfficiency = calculateSugarExtractionEfficiency(
    totalExtractedSugarKg,
    agaveKg,
    theoretical.artUsed
  );

  // Litros alcohólicos en rectificaciones (Corazón / Tequila final)
  const rectifications = distillations.filter((d) => d.type === "RECTIFICACION" && d.status === "TERMINADA");
  let totalHeartLAA = 0;
  let totalRectifiedLiters = 0;
  rectifications.forEach((r) => {
    const lts = r.finalLiters ?? r.heartLiters ?? 0;
    const alc = r.finalAlcohol ?? 40;
    totalRectifiedLiters += lts;
    totalHeartLAA += calculateLAA(lts, alc);
  });

  const costPerLAA = totalHeartLAA > 0 ? Number((totalCost / totalHeartLAA).toFixed(2)) : 0;

  // Calificación del Maestro Tequilero:
  // Excelente: kg/L entre 6.5 y 8.5
  // Bueno: kg/L entre 8.5 y 10.0
  // Por debajo: kg/L > 10.0
  let qualityRating: "EXCELENTE" | "BUENO" | "MEJORABLE" | "EN_PROCESO" = "EN_PROCESO";
  let ratingMessage = "Lote en desarrollo.";

  if (actualKgPerLiter !== null) {
    if (actualKgPerLiter <= 8.5) {
      qualityRating = "EXCELENTE";
      ratingMessage = `Rendimiento excepcional (${actualKgPerLiter} kg/L). Alta eficiencia en extracción y fermentación.`;
    } else if (actualKgPerLiter <= 10.5) {
      qualityRating = "BUENO";
      ratingMessage = `Rendimiento aceptable (${actualKgPerLiter} kg/L). Cumple con el perfil operativo de la planta.`;
    } else {
      qualityRating = "MEJORABLE";
      ratingMessage = `Rendimiento bajo (${actualKgPerLiter} kg/L). Revisar posibles pérdidas en bagazo, vinazas o fermentación incompleta.`;
    }
  }

  return {
    theoretical,
    actualLiters,
    actualKgPerLiter,
    actualCostPerLiter,
    costPerLAA,
    totalHeartLAA: Number(totalHeartLAA.toFixed(1)),
    totalMashLiters,
    totalExtractedSugarKg: Number(totalExtractedSugarKg.toFixed(1)),
    extractionEfficiency,
    qualityRating,
    ratingMessage,
  };
}
