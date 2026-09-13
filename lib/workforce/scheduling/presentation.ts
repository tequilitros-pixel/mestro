export const SCHEDULE_WARNING_LABELS: Record<string, string> = {
  UNAVAILABLE: "Fuera de disponibilidad",
  UNKNOWN_AVAILABILITY: "Disponibilidad sin confirmar",
  OVERTIME_RISK: "Podría exceder sus horas",
  UNASSIGNED: "Falta asignar una persona",
};

export function scheduleWarningLabel(code: string) {
  return SCHEDULE_WARNING_LABELS[code] ?? "Requiere atención";
}

export function canPublishSchedule(input: {
  published: boolean;
  blockers: string[];
  shiftCount?: number;
}) {
  return !input.published && input.blockers.length === 0 && input.shiftCount !== 0;
}

export function canCopyPreviousWeek(input: {
  published: boolean;
  currentShiftCount: number;
  previousShiftCount: number;
}) {
  return (
    !input.published &&
    input.currentShiftCount === 0 &&
    input.previousShiftCount > 0
  );
}
