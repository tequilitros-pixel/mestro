export type WorkforceRequestKind =
  | "MISSING_CLOCK_IN"
  | "MISSING_CLOCK_OUT"
  | "WRONG_CLOCK_IN"
  | "WRONG_CLOCK_OUT"
  | "OTHER";

export type CorrectionEventType = "CLOCK_IN" | "CLOCK_OUT";
export type CorrectionType = "MODIFY_OCCURRED_TIME" | "ADD_MISSING_EVENT" | "VOID_EVENT";

export const requestKindLabels: Record<WorkforceRequestKind, string> = {
  MISSING_CLOCK_IN: "Olvidé registrar entrada",
  MISSING_CLOCK_OUT: "Olvidé registrar salida",
  WRONG_CLOCK_IN: "Mi hora de entrada es incorrecta",
  WRONG_CLOCK_OUT: "Mi hora de salida es incorrecta",
  OTHER: "Otro problema con mi registro",
};

export const correctionStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export const correctionEventLabels: Record<string, string> = {
  CLOCK_IN: "Entrada",
  CLOCK_OUT: "Salida",
};

export function requestKindToCorrection(kind: WorkforceRequestKind) {
  switch (kind) {
    case "MISSING_CLOCK_IN":
      return { type: "ADD_MISSING_EVENT" as const, proposedEventType: "CLOCK_IN" as const, requiresTarget: false };
    case "MISSING_CLOCK_OUT":
      return { type: "ADD_MISSING_EVENT" as const, proposedEventType: "CLOCK_OUT" as const, requiresTarget: false };
    case "WRONG_CLOCK_IN":
      return { type: "MODIFY_OCCURRED_TIME" as const, proposedEventType: null, requiresTarget: true, targetType: "CLOCK_IN" as const };
    case "WRONG_CLOCK_OUT":
      return { type: "MODIFY_OCCURRED_TIME" as const, proposedEventType: null, requiresTarget: true, targetType: "CLOCK_OUT" as const };
    case "OTHER":
      return { type: "MODIFY_OCCURRED_TIME" as const, proposedEventType: null, requiresTarget: true };
  }
}

export function correctionLabel(type: string, proposedEventType?: string | null) {
  if (type === "ADD_MISSING_EVENT") {
    return proposedEventType === "CLOCK_IN" ? requestKindLabels.MISSING_CLOCK_IN : requestKindLabels.MISSING_CLOCK_OUT;
  }
  if (type === "MODIFY_OCCURRED_TIME") {
    return "Hora de registro incorrecta";
  }
  return "Otro problema con el registro";
}

export function correctionEventLabel(type: string | null | undefined) {
  return type ? correctionEventLabels[type] ?? "Registro" : "Registro";
}
