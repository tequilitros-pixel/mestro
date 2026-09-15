export type LegacyReportSource = "V2_LEDGER" | "LEGACY_READ_MODEL";

export type LegacyConversionClassification =
  | "V2_LEDGER"
  | "NO_BASE_UNIT"
  | "MISSING_PRESENTATION"
  | "HISTORICAL_FACTOR_MISMATCH"
  | "LEGACY_NEGATIVE"
  | "LEGACY_TEMPORARY_READ"
  | "CURRENT_CONFIGURATION_CONSISTENT";

export type LegacyReportClassification = {
  source: LegacyReportSource;
  classification: LegacyConversionClassification;
  reasons: string[];
};

/**
 * Classifies a read-only legacy row. It deliberately does not propose or
 * perform a repair: a mathematically plausible conversion is still reported
 * as evidence that requires an explicit, auditable decision.
 */
export function classifyLegacyInventoryRow(input: {
  hasV2Balance: boolean;
  currentStock: number;
  hasLegacyEvidence: boolean;
  hasBaseUnit: boolean;
  hasValidPresentation: boolean;
  historicalFactorPresent: boolean;
  historicalFactorMatches: boolean;
}): LegacyReportClassification | null {
  if (input.hasV2Balance) {
    return {
      source: "V2_LEDGER",
      classification: "V2_LEDGER",
      reasons: input.currentStock < 0 ? ["Balance V2 negativo inesperado"] : [],
    };
  }

  if (!input.hasLegacyEvidence) return null;

  const reasons: string[] = [];
  let classification: LegacyConversionClassification = "LEGACY_TEMPORARY_READ";

  if (!input.hasBaseUnit) {
    classification = "NO_BASE_UNIT";
    reasons.push("Unidad base V2 no configurada");
  } else if (!input.hasValidPresentation) {
    classification = "MISSING_PRESENTATION";
    reasons.push("Presentación comercial ausente o inválida");
  } else if (input.historicalFactorPresent && !input.historicalFactorMatches) {
    classification = "HISTORICAL_FACTOR_MISMATCH";
    reasons.push("El factor histórico no coincide con la configuración actual");
  } else if (input.currentStock < 0) {
    classification = "LEGACY_NEGATIVE";
    reasons.push("Saldo legacy negativo; conservar signo y revisar manualmente");
  } else if (input.historicalFactorPresent && input.historicalFactorMatches) {
    classification = "CURRENT_CONFIGURATION_CONSISTENT";
    reasons.push("La configuración actual es consistente con el factor histórico observado");
  } else {
    reasons.push("Lectura temporal: último conteo cerrado más entradas posteriores");
  }

  if (input.currentStock < 0 && classification !== "LEGACY_NEGATIVE") {
    reasons.push("Saldo legacy negativo; conservar signo y revisar manualmente");
  }

  return { source: "LEGACY_READ_MODEL", classification, reasons };
}
