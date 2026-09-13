export function shiftLinkProximityMilliseconds(minutes: number) {
  return minutes * 60_000;
}

export function assertUnscheduledWorkPolicy(input: {
  eventType: string;
  allowUnscheduledWork: boolean;
  hasMatchingShift: boolean;
}) {
  if (
    input.eventType === "CLOCK_IN" &&
    !input.allowUnscheduledWork &&
    !input.hasMatchingShift
  )
    throw new Error("El trabajo no programado está deshabilitado por política.");
}
