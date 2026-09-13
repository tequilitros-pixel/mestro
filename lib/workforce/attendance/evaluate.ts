import { assertAttendancePolicy, type AttendancePolicy } from "./policy";
import type {
  AttendanceEvaluation,
  AttendanceSession,
  AttendanceSeverity,
  AttendanceShift,
  AttendanceType,
  ExpectedAttendanceException,
} from "./types";

const minutes = (milliseconds: number) =>
  Math.max(0, Math.floor(milliseconds / 60_000));

export function canAccessAttendanceBranch(
  role: string,
  accessibleBranchIds: string[] | null,
  branchId: string,
) {
  return role === "ADMIN" || Boolean(accessibleBranchIds?.includes(branchId));
}

export function evaluateAttendance(input: {
  shifts: AttendanceShift[];
  sessions: AttendanceSession[];
  policy: AttendancePolicy;
  now: Date;
}): AttendanceEvaluation {
  const policy = assertAttendancePolicy(input.policy);
  const published = input.shifts.filter(
    (shift) => shift.status === "PUBLISHED" && shift.employmentId,
  );
  const publishedIds = new Set(published.map((shift) => shift.id));
  const sessionsByShift = new Map<string, AttendanceSession[]>();
  for (const session of input.sessions) {
    if (!session.shiftId) continue;
    const list = sessionsByShift.get(session.shiftId) ?? [];
    list.push(session);
    sessionsByShift.set(session.shiftId, list);
  }
  const expected: ExpectedAttendanceException[] = [];
  const add = (
    base: {
      shift: AttendanceShift | null;
      session: AttendanceSession | null;
    },
    type: AttendanceType,
    severity: AttendanceSeverity,
    differenceMinutes: number | null,
  ) => {
    const employmentId =
      base.session?.employmentId ?? base.shift?.employmentId ?? null;
    if (!employmentId) return;
    const subject = base.shift
      ? `shift:${base.shift.id}`
      : `session:${base.session!.id}`;
    const derivationKey = `${subject}:${type}`;
    const facts = [
      derivationKey,
      base.shift?.startAt.toISOString() ?? "-",
      base.shift?.endAt.toISOString() ?? "-",
      base.session?.startedAt?.toISOString() ?? "-",
      base.session?.endedAt?.toISOString() ?? "-",
      String(base.session?.breakMinutes ?? "-"),
      String(differenceMinutes ?? "-"),
    ].join("|");
    expected.push({
      derivationKey,
      evidenceKey: facts,
      employmentId,
      branchId: base.session?.branchId ?? base.shift!.branchId,
      businessDate:
        base.session?.businessDate ?? base.shift!.businessDate,
      shiftId: base.shift?.id ?? null,
      workSessionId: base.session?.id ?? null,
      type,
      severity,
      scheduledStart: base.shift?.startAt ?? null,
      scheduledEnd: base.shift?.endAt ?? null,
      actualStart: base.session?.startedAt ?? null,
      actualEnd: base.session?.endedAt ?? null,
      differenceMinutes,
      policySnapshot: policy,
    });
  };

  for (const shift of published) {
    const session = (sessionsByShift.get(shift.id) ?? []).sort(
      (a, b) =>
        (a.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    )[0];
    if (!session) {
      const threshold = new Date(
        shift.startAt.getTime() + policy.noShowThresholdMinutes * 60_000,
      );
      if (input.now >= threshold)
        add({ shift, session: null }, "NO_SHOW", "CRITICAL", null);
      continue;
    }
    if (!session.startedAt)
      add({ shift, session }, "MISSING_CLOCK_IN", "CRITICAL", null);
    else {
      const lateBy = minutes(
        session.startedAt.getTime() - shift.startAt.getTime(),
      );
      if (lateBy > policy.lateGraceMinutes)
        add({ shift, session }, "LATE_ARRIVAL", "WARNING", lateBy);
    }
    if (session.endedAt) {
      const earlyBy = minutes(
        shift.endAt.getTime() - session.endedAt.getTime(),
      );
      if (earlyBy > policy.earlyDepartureGraceMinutes)
        add({ shift, session }, "EARLY_DEPARTURE", "WARNING", earlyBy);
    } else if (
      input.now.getTime() >=
      shift.endAt.getTime() +
        policy.missingClockOutThresholdMinutes * 60_000
    ) {
      add({ shift, session }, "MISSING_CLOCK_OUT", "CRITICAL", null);
    }
    if (session.status === "INCOMPLETE")
      add({ shift, session }, "INCOMPLETE_BREAK", "WARNING", null);
    if (
      session.breakMinutes !== null &&
      session.breakMinutes > policy.longBreakThresholdMinutes
    )
      add(
        { shift, session },
        "LONG_BREAK",
        "WARNING",
        session.breakMinutes - policy.longBreakThresholdMinutes,
      );
  }

  for (const session of input.sessions)
    if (!session.shiftId || !publishedIds.has(session.shiftId))
      add({ shift: null, session }, "UNSCHEDULED_WORK", "WARNING", null);

  return {
    expected: expected.sort(
      (a, b) =>
        a.businessDate.getTime() - b.businessDate.getTime() ||
        a.derivationKey.localeCompare(b.derivationKey),
    ),
    evaluatedShiftIds: published.map((shift) => shift.id),
    evaluatedSessionIds: input.sessions.map((session) => session.id),
  };
}
