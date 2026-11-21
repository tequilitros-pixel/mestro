import type {
  BridgeIssue,
  BridgeResult,
  DifferenceCategory,
  MigrationClassification,
} from "./types";

const MINUTE_MS = 60_000;

function issue(
  category: BridgeIssue["category"],
  field: string,
  detail: string,
): BridgeIssue {
  return { category, field, detail };
}

export type LegacyUser = {
  id: string;
  name: string;
  active: boolean;
  email?: string | null;
  phone?: string | null;
};

export type IdentityCandidate = {
  sourceUserId: string;
  userId: string;
  displayName: string;
  employeeNumber: null;
  firstName: null;
  lastName: null;
  active: boolean;
  employment: {
    status: "ACTIVE" | "INACTIVE";
    startedAt: null;
    endedAt: null;
    dataConfidence: "LEGACY_UNKNOWN";
  };
};

export function userToIdentityCandidate(
  user: LegacyUser,
): BridgeResult<IdentityCandidate> {
  const name = user.name.trim();
  if (!name) {
    return {
      candidate: null,
      classification: "REQUIRES_REVIEW",
      issues: [issue("MISSING_DATA", "name", "Employee identity requires a human-readable name")],
    };
  }

  return {
    candidate: {
      sourceUserId: user.id,
      userId: user.id,
      displayName: name,
      employeeNumber: null,
      firstName: null,
      lastName: null,
      active: user.active,
      employment: {
        status: user.active ? "ACTIVE" : "INACTIVE",
        startedAt: null,
        endedAt: null,
        dataConfidence: "LEGACY_UNKNOWN",
      },
    },
    classification: "AUTO_MIGRATION_WITH_NULL_UNKNOWN",
    issues: [
      issue("UNRECOVERABLE_HISTORICAL_DETAIL", "employment.startedAt", "Legacy User has no hire date"),
      issue("AMBIGUOUS_DATA", "employee.name", "Legacy has one display name, not verified first/last names"),
    ],
  };
}

export type LegacySalaryRate = {
  id: string;
  userId: string;
  scheme: "HORA" | "DIA" | "SEMANA";
  amount: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type PayRateCandidate = {
  sourceSalaryRateId: string;
  sourceUserId: string;
  employmentCandidateKey: string;
  rateType: "HOURLY" | "DAILY" | "WEEKLY";
  amount: number;
  currency: null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

const rateType = {
  HORA: "HOURLY",
  DIA: "DAILY",
  SEMANA: "WEEKLY",
} as const;

export function salaryRateToPayRateCandidate(
  rate: LegacySalaryRate,
): BridgeResult<PayRateCandidate> {
  if (!(rate.amount >= 0) || (rate.effectiveTo !== null && rate.effectiveTo <= rate.effectiveFrom)) {
    return {
      candidate: null,
      classification: "REQUIRES_REVIEW",
      issues: [issue("CONFLICTING_DATA", "effectiveRange", "Rate amount or effective range is invalid")],
    };
  }
  return {
    candidate: {
      sourceSalaryRateId: rate.id,
      sourceUserId: rate.userId,
      employmentCandidateKey: `legacy-user:${rate.userId}`,
      rateType: rateType[rate.scheme],
      amount: rate.amount,
      currency: null,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
    },
    classification: "AUTO_MIGRATION_WITH_NULL_UNKNOWN",
    issues: [issue("MISSING_DATA", "currency", "SalaryRate does not store currency")],
  };
}

export function analyzeRateCoverage(rates: LegacySalaryRate[]): BridgeIssue[] {
  const sorted = [...rates].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  const issues: BridgeIssue[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.effectiveTo === null || previous.effectiveTo > current.effectiveFrom) {
      issues.push(issue("CONFLICTING_DATA", "effectiveRange", `${previous.id} overlaps ${current.id}`));
    } else if (previous.effectiveTo < current.effectiveFrom) {
      issues.push(issue("MISSING_DATA", "effectiveRange", `${previous.id} has a gap before ${current.id}`));
    }
  }
  return issues;
}

export type LegacyScheduleWeek = {
  id: string;
  weekStart: Date;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  publishedById: string | null;
};

export type LegacyScheduledShift = {
  id: string;
  userId: string;
  branchId: string | null;
  date: Date;
  type: "TURNO" | "DESCANSO";
  startTime: string | null;
  endTime: string | null;
};

export type ShiftCandidate = {
  sourceShiftId: string;
  employmentCandidateKey: string;
  branchId: string;
  businessDate: string;
  startAt: Date;
  endAt: Date;
  expectedBreakMinutes: null;
  publicationHistory: "UNKNOWN";
};

export type SchedulePeriodCandidate = {
  sourceScheduleWeekId: string;
  branchId: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "PUBLISHED";
  publicationHistory: "UNKNOWN";
  shifts: ShiftCandidate[];
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function localInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wallAsUtc;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
    );
    guess -= represented - wallAsUtc;
  }
  return new Date(guess);
}

export function scheduledShiftToCandidate(
  shift: LegacyScheduledShift,
  timeZone: string | null,
): BridgeResult<ShiftCandidate> {
  if (shift.type === "DESCANSO") {
    return {
      candidate: null,
      classification: "ARCHIVE_ONLY",
      issues: [issue("UNRECOVERABLE_HISTORICAL_DETAIL", "type", "Day-off marker is not authorized planned work")],
    };
  }
  if (!shift.branchId || !shift.startTime || !shift.endTime || !timeZone) {
    return {
      candidate: null,
      classification: "REQUIRES_REVIEW",
      issues: [issue("MISSING_DATA", "shift", "Branch, times and IANA timezone are required")],
    };
  }
  const businessDate = dateOnly(shift.date);
  const endDate = shift.endTime <= shift.startTime ? addDays(businessDate, 1) : businessDate;
  return {
    candidate: {
      sourceShiftId: shift.id,
      employmentCandidateKey: `legacy-user:${shift.userId}`,
      branchId: shift.branchId,
      businessDate,
      startAt: localInstant(businessDate, shift.startTime, timeZone),
      endAt: localInstant(endDate, shift.endTime, timeZone),
      expectedBreakMinutes: null,
      publicationHistory: "UNKNOWN",
    },
    classification: "AUTO_MIGRATION_WITH_NULL_UNKNOWN",
    issues: [
      issue("MISSING_DATA", "expectedBreakMinutes", "Legacy shift has no planned break duration"),
      issue("UNRECOVERABLE_HISTORICAL_DETAIL", "publicationHistory", "Legacy week stores state, not revisions"),
    ],
  };
}

export function scheduleWeekToPeriodCandidates(
  week: LegacyScheduleWeek,
  shifts: LegacyScheduledShift[],
  branchTimezones: ReadonlyMap<string, string>,
): BridgeResult<SchedulePeriodCandidate[]> {
  const byBranch = new Map<string, ShiftCandidate[]>();
  const issues: BridgeIssue[] = [];
  for (const shift of shifts) {
    const mapped = scheduledShiftToCandidate(
      shift,
      shift.branchId ? (branchTimezones.get(shift.branchId) ?? null) : null,
    );
    issues.push(...mapped.issues);
    if (!mapped.candidate) continue;
    const list = byBranch.get(mapped.candidate.branchId) ?? [];
    list.push(mapped.candidate);
    byBranch.set(mapped.candidate.branchId, list);
  }
  const periodStart = dateOnly(week.weekStart);
  const candidates = [...byBranch].map(([branchId, mappedShifts]) => ({
    sourceScheduleWeekId: week.id,
    branchId,
    periodStart,
    periodEnd: addDays(periodStart, 6),
    status: week.status,
    publicationHistory: "UNKNOWN" as const,
    shifts: mappedShifts,
  }));
  return {
    candidate: candidates,
    classification: issues.length ? "AUTO_MIGRATION_WITH_NULL_UNKNOWN" : "SAFE_AUTO_MIGRATION",
    issues,
  };
}

export type LegacyTimeClockEntry = {
  id: string;
  userId: string;
  branchId: string;
  clockIn: Date;
  clockOut: Date | null;
  source: "CHECADOR" | "MANUAL";
  scheduledShiftId: string | null;
};

export type WorkSessionCandidate = {
  sourceEntryId: string;
  source: "LEGACY_COMPOSITE_ENTRY";
  employmentCandidateKey: string;
  branchId: string;
  shiftCandidateKey: string | null;
  businessDate: string;
  startedAt: Date;
  endedAt: Date | null;
  workedMinutes: number | null;
  breakMinutes: null;
  originalClockEventsAvailable: false;
};

function businessDateInZone(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(value);
}

export function timeClockEntryToWorkSessionCandidate(
  entry: LegacyTimeClockEntry,
  timeZone: string,
  scheduledBusinessDate?: string,
): BridgeResult<WorkSessionCandidate> {
  const workedMinutes = entry.clockOut
    ? Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / MINUTE_MS)
    : null;
  if (workedMinutes !== null && workedMinutes < 0) {
    return {
      candidate: null,
      classification: "REQUIRES_REVIEW",
      issues: [issue("CONFLICTING_DATA", "clockOut", "Clock-out precedes clock-in")],
    };
  }
  return {
    candidate: {
      sourceEntryId: entry.id,
      source: "LEGACY_COMPOSITE_ENTRY",
      employmentCandidateKey: `legacy-user:${entry.userId}`,
      branchId: entry.branchId,
      shiftCandidateKey: entry.scheduledShiftId,
      businessDate: scheduledBusinessDate ?? businessDateInZone(entry.clockIn, timeZone),
      startedAt: entry.clockIn,
      endedAt: entry.clockOut,
      workedMinutes,
      breakMinutes: null,
      originalClockEventsAvailable: false,
    },
    classification: "AUTO_MIGRATION_WITH_NULL_UNKNOWN",
    issues: [
      issue("UNRECOVERABLE_HISTORICAL_DETAIL", "clockEvents", "Legacy stores one composite row, not original event evidence"),
      issue("MISSING_DATA", "breakMinutes", "Legacy entry has no break-event stream"),
    ],
  };
}

export type LegacyEditRequest = {
  id: string;
  timeClockId: string;
  originalClockIn: Date;
  originalClockOut: Date | null;
  requestedClockIn: Date;
  requestedClockOut: Date;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  reason: string | null;
};

export type ClockCorrectionCandidate = {
  sourceRequestId: string;
  legacyCompositeEntryId: string;
  type: "ADD_MISSING_EVENT" | "MODIFY_OCCURRED_TIME";
  status: "PENDING" | "APPROVED" | "REJECTED";
  proposedEventType: "CLOCK_OUT" | null;
  proposedOccurredAt: Date;
  targetClockEventId: null;
};

export function editRequestToCorrectionCandidate(
  request: LegacyEditRequest,
): BridgeResult<ClockCorrectionCandidate> {
  const status = { PENDIENTE: "PENDING", APROBADO: "APPROVED", RECHAZADO: "REJECTED" } as const;
  const missingOut = request.originalClockOut === null;
  const clockInChanged = request.originalClockIn.getTime() !== request.requestedClockIn.getTime();
  const clockOutChanged =
    request.originalClockOut === null ||
    request.originalClockOut.getTime() !== request.requestedClockOut.getTime();
  if (!clockInChanged && !clockOutChanged) {
    return {
      candidate: null,
      classification: "ARCHIVE_ONLY",
      issues: [issue("UNRECOVERABLE_HISTORICAL_DETAIL", "request", "Request contains no effective time change")],
    };
  }
  if (clockInChanged && clockOutChanged && !missingOut) {
    return {
      candidate: null,
      classification: "REQUIRES_REVIEW",
      issues: [issue("AMBIGUOUS_DATA", "request", "One legacy request changes two conceptual events")],
    };
  }
  return {
    candidate: {
      sourceRequestId: request.id,
      legacyCompositeEntryId: request.timeClockId,
      type: missingOut ? "ADD_MISSING_EVENT" : "MODIFY_OCCURRED_TIME",
      status: status[request.status],
      proposedEventType: missingOut ? "CLOCK_OUT" : null,
      proposedOccurredAt: missingOut || clockOutChanged ? request.requestedClockOut : request.requestedClockIn,
      targetClockEventId: null,
    },
    classification: "REQUIRES_REVIEW",
    issues: [issue("UNRECOVERABLE_HISTORICAL_DETAIL", "targetClockEventId", "Legacy composite entry has no original target event ID")],
  };
}

export type LegacyOvertime = {
  id: string;
  userId: string;
  weekStart: Date;
  overtimeHours: number;
  doubleHours: number;
  tripleHours: number;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
};

export function overtimeToTimesheetCandidate(record: LegacyOvertime) {
  return {
    sourceOvertimeId: record.id,
    employmentCandidateKey: `legacy-user:${record.userId}`,
    periodStart: dateOnly(record.weekStart),
    overtimeMinutes: Math.round(record.overtimeHours * 60),
    overtimeTier1Minutes: Math.round(record.doubleHours * 60),
    overtimeTier2Minutes: Math.round(record.tripleHours * 60),
    approval: record.status === "APROBADO" ? "APPROVED" : record.status === "RECHAZADO" ? "REJECTED" : "PENDING",
    classification: "SAFE_AUTO_MIGRATION" as MigrationClassification,
  };
}

export type LegacyPayrollEntry = {
  id: string;
  userId: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  adjustmentsTotal: number;
  totalPay: number;
};

export type PayrollComparison = {
  sourcePayrollEntryId: string;
  legacyWorkedMinutes: number;
  legacyGross: number;
  workforceGrossCandidate: number;
  differenceAmount: number;
  comparable: boolean;
  category: DifferenceCategory;
};

export function comparePayrollEntry(
  entry: LegacyPayrollEntry,
  workforceGrossCandidate: number,
): PayrollComparison {
  const internallyExpected = entry.basePay + entry.overtimePay + entry.adjustmentsTotal;
  const internallyConsistent = Math.abs(internallyExpected - entry.totalPay) < 0.005;
  const differenceAmount = workforceGrossCandidate - entry.totalPay;
  return {
    sourcePayrollEntryId: entry.id,
    legacyWorkedMinutes: Math.round(entry.totalHours * 60),
    legacyGross: entry.totalPay,
    workforceGrossCandidate,
    differenceAmount,
    comparable: internallyConsistent,
    category: !internallyConsistent ? "LEGACY_LIMITATION" : Math.abs(differenceAmount) < 0.005 ? "EXPECTED" : "POLICY_DIFFERENCE",
  };
}

export function compareWorkedMinutes(legacyMinutes: number, candidateMinutes: number) {
  const differenceMinutes = candidateMinutes - legacyMinutes;
  return {
    legacyMinutes,
    candidateMinutes,
    differenceMinutes,
    category: (differenceMinutes === 0 ? "EXPECTED" : "MAPPING_BUG") as DifferenceCategory,
  };
}
