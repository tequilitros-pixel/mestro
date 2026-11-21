export const clockStateLabels: Record<string, string> = {
  NO_SESSION: "Listo para iniciar",
  CLOCKED_IN: "Turno en curso",
  ON_BREAK: "Descanso en curso",
};

export const clockEventLabels: Record<string, string> = {
  CLOCK_IN: "Entrada",
  CLOCK_OUT: "Salida",
  BREAK_START: "Inicio de descanso",
  BREAK_END: "Fin de descanso",
};

export const attendanceTypeLabels: Record<string, string> = {
  LATE_ARRIVAL: "Entrada tardía",
  EARLY_DEPARTURE: "Salida anticipada",
  NO_SHOW: "Ausencia",
  UNSCHEDULED_WORK: "Trabajo no programado",
  MISSING_CLOCK_IN: "Falta entrada",
  MISSING_CLOCK_OUT: "Falta salida",
  INCOMPLETE_BREAK: "Descanso incompleto",
  LONG_BREAK: "Descanso prolongado",
  OUTSIDE_GEOFENCE: "Ubicación fuera de zona",
};

export const timesheetStatusLabels: Record<string, string> = {
  OPEN: "Pendiente",
  REVIEW: "En revisión",
  APPROVED: "Aprobado",
  LOCKED: "Bloqueado para nómina",
};

export const timesheetReadinessLabels: Record<string, string> = {
  READY: "Listo para aprobar",
  NEEDS_REVIEW: "Requiere revisión",
  BLOCKED: "Bloqueado por incidencia",
};

export const overtimeModeLabels: Record<string, string> = {
  PREVIEW: "Vista previa",
  FINAL: "Finalizado",
  STALE: "Requiere recalcular",
  BLOCKED: "Bloqueado",
};

export const payrollStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  READY: "Listo para revisar",
  APPROVED: "Aprobado",
  PAID: "Pagado",
  BLOCKED: "Bloqueado",
};

export const rateTypeLabels: Record<string, string> = {
  HOURLY: "Por hora",
  DAILY: "Por día",
  WEEKLY: "Por semana",
  SALARY: "Salario",
};

export function humanLabel(labels: Record<string, string>, value: string | null | undefined) {
  return value ? labels[value] ?? value : "Sin registrar";
}
