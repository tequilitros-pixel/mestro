export type AttendancePolicy = {
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  longBreakThresholdMinutes: number;
  noShowThresholdMinutes: number;
  missingClockOutThresholdMinutes: number;
};

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = Object.freeze({
  lateGraceMinutes: 5,
  earlyDepartureGraceMinutes: 5,
  longBreakThresholdMinutes: 60,
  noShowThresholdMinutes: 30,
  missingClockOutThresholdMinutes: 60,
});

export function assertAttendancePolicy(policy: AttendancePolicy) {
  for (const [key, value] of Object.entries(policy))
    if (!Number.isInteger(value) || value < 0 || value > 24 * 60)
      throw new Error(`Política de asistencia inválida: ${key}`);
  return policy;
}
