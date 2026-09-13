import type { AttendancePolicy } from "./policy";

export type AttendanceType =
  | "LATE_ARRIVAL"
  | "EARLY_DEPARTURE"
  | "NO_SHOW"
  | "UNSCHEDULED_WORK"
  | "MISSING_CLOCK_IN"
  | "MISSING_CLOCK_OUT"
  | "INCOMPLETE_BREAK"
  | "LONG_BREAK";

export type AttendanceSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AttendanceShift = {
  id: string;
  employmentId: string | null;
  branchId: string;
  businessDate: Date;
  startAt: Date;
  endAt: Date;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
};

export type AttendanceSession = {
  id: string;
  employmentId: string;
  branchId: string;
  businessDate: Date;
  shiftId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  breakMinutes: number | null;
  status: "OPEN" | "COMPLETE" | "INCOMPLETE";
};

export type ExpectedAttendanceException = {
  derivationKey: string;
  evidenceKey: string;
  employmentId: string;
  branchId: string;
  businessDate: Date;
  shiftId: string | null;
  workSessionId: string | null;
  type: AttendanceType;
  severity: AttendanceSeverity;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  differenceMinutes: number | null;
  policySnapshot: AttendancePolicy;
};

export type AttendanceEvaluation = {
  expected: ExpectedAttendanceException[];
  evaluatedShiftIds: string[];
  evaluatedSessionIds: string[];
};
