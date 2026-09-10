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

export function formatAttendanceMinutes(value: number) {
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 60)}h ${absolute % 60}m`;
}

export function humanAttendanceIssueLabel(type: string, geofenceResult?: string) {
  if (type === "OUTSIDE_GEOFENCE") {
    if (geofenceResult === "PERMISSION_DENIED" || geofenceResult === "UNAVAILABLE") return "Ubicación no disponible";
    if (geofenceResult === "LOW_ACCURACY") return "Ubicación imprecisa";
  }
  return attendanceIssueLabels[type] ?? "Revisar registro";
}

export function isHiddenAttendanceType(type: string) {
  return (HIDDEN_ATTENDANCE_TYPES as readonly string[]).includes(type);
}
