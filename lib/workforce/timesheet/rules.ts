export type Readiness = "READY" | "NEEDS_REVIEW" | "BLOCKED";
export type TimesheetSession = {
  id: string;
  businessDate: Date;
  workedMinutes: number;
  breakMinutes: number | null;
  status: "OPEN" | "COMPLETE" | "INCOMPLETE";
  branchId: string;
};
export type TimesheetShift = {
  businessDate: Date;
  startAt: Date;
  endAt: Date;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
};
export type TimesheetIssue = {
  businessDate: Date;
  type: string;
  severity: string;
  status: string;
};

const DAY = 86_400_000;
export const dateKey = (value: Date) => value.toISOString().slice(0, 10);
export function mondayOf(value: Date) {
  const date = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - offset * DAY);
}
export const sundayOf = (monday: Date) =>
  new Date(monday.getTime() + 6 * DAY);
export const formatMinutes = (value: number) => {
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 60)}h ${absolute % 60}m`;
};

export function aggregateWeek(input: {
  periodStart: Date;
  sessions: TimesheetSession[];
  shifts: TimesheetShift[];
  issues: TimesheetIssue[];
}) {
  const blockingTypes = new Set([
    "MISSING_CLOCK_IN",
    "MISSING_CLOCK_OUT",
    "INCOMPLETE_BREAK",
  ]);
  return Array.from({ length: 7 }, (_, offset) => {
    const businessDate = new Date(input.periodStart.getTime() + offset * DAY);
    const key = dateKey(businessDate);
    const sessions = input.sessions.filter(
      (session) => dateKey(session.businessDate) === key,
    );
    const shifts = input.shifts.filter(
      (shift) =>
        shift.status === "PUBLISHED" && dateKey(shift.businessDate) === key,
    );
    const issues = input.issues.filter(
      (issue) => issue.status === "OPEN" && dateKey(issue.businessDate) === key,
    );
    const incomplete = sessions.some((session) => session.status !== "COMPLETE");
    const blocking = issues.some(
      (issue) =>
        issue.severity === "CRITICAL" && blockingTypes.has(issue.type),
    );
    return {
      businessDate,
      sessions,
      workedMinutes: sessions.reduce(
        (total, session) => total + session.workedMinutes,
        0,
      ),
      breakMinutes: sessions.reduce(
        (total, session) => total + (session.breakMinutes ?? 0),
        0,
      ),
      sessionCount: sessions.length,
      scheduledMinutes: shifts.reduce(
        (total, shift) =>
          total +
          Math.max(0, Math.round((shift.endAt.getTime() - shift.startAt.getTime()) / 60_000)),
        0,
      ),
      attendanceIssueCount: issues.length,
      needsReview: incomplete || issues.length > 0,
      blocking,
    };
  });
}

export function timesheetReadiness(
  lines: Array<{ needsReview: boolean; blocking: boolean }>,
): Readiness {
  if (lines.some((line) => line.blocking)) return "BLOCKED";
  if (lines.some((line) => line.needsReview)) return "NEEDS_REVIEW";
  return "READY";
}
