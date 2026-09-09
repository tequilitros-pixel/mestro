export const HIDDEN_ATTENDANCE_TYPES = [
  "BREAK_ANOMALY",
  "INCOMPLETE_BREAK",
  "LONG_BREAK",
] as const;

export const attendanceIssueLabels: Record<string, string> = {
  LATE: "Llegó tarde",
  LATE_ARRIVAL: "Llegó tarde",
  EARLY_DEPARTURE: "Salió antes",
  NO_SHOW: "No ha registrado entrada",
  MISSING_PUNCH: "Revisar registro",
  MISSING_CLOCK_IN: "Falta registrar entrada",
  MISSING_CLOCK_OUT: "Falta registrar salida",
  UNSCHEDULED_WORK: "Trabajo no programado",
  OUTSIDE_GEOFENCE: "Fuera de zona autorizada",
  OVERTIME: "Revisar horas extra",
};

export const attendanceStatusLabels: Record<string, string> = {
  NONE: "Normal",
  OPEN: "Pendiente",
  RESOLVED: "Resuelto",
  DISMISSED: "Revisado",
};

export const attendanceStateLabels: Record<string, string> = {
  ATTENTION: "Requiere atención",
  WORKING: "Trabajando",
  COMPLETED: "Completado",
  WAITING: "Esperando entrada",
  REVIEWED: "Revisado",
};

export function humanAttendanceIssueLabel(type: string) {
  return attendanceIssueLabels[type] ?? "Revisar registro";
}

export function isHiddenAttendanceType(type: string) {
  return (HIDDEN_ATTENDANCE_TYPES as readonly string[]).includes(type);
}
