import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateKey, localBusinessDate } from "@/lib/workforce/timesheet/rules";
import { canAccessAttendanceBranch } from "./evaluate";
import { reconcileAttendanceScope } from "./reconcile";
import { HIDDEN_ATTENDANCE_TYPES } from "./presentation";

export type AttendanceActor = {
  id: string;
  role: string;
  accessibleBranchIds: string[] | null;
};

export type AttendanceStatusFilter = "ALL" | "OPEN" | "RESOLVED" | "DISMISSED";
export type AttendanceIncidenceFilter = "ALL" | "WITH" | "WITHOUT";
export type AttendanceOccurrenceStatus = "NONE" | "OPEN" | "RESOLVED" | "DISMISSED";
export type AttendanceOccurrenceState =
  | "ATTENTION"
  | "WORKING"
  | "COMPLETED"
  | "WAITING"
  | "REVIEWED";

export type AttendanceOccurrence = {
  id: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  branchTimezone: string | null;
  businessDate: Date;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  workedMinutes: number | null;
  differenceMinutes: number | null;
  issueTypes: string[];
  status: AttendanceOccurrenceStatus;
  state: AttendanceOccurrenceState;
  workSessionId: string | null;
  primaryExceptionId: string | null;
  resolution: string | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  action: "CORRECT" | "REVIEW" | "HOURS" | null;
};

const operationalEmploymentWhere = {
  status: "ACTIVE",
  employee: { active: true },
} satisfies Prisma.EmploymentWhereInput;

const exceptionInclude = {
  employment: {
    select: { employee: { select: { displayName: true } } },
  },
  branch: { select: { id: true, name: true, timezone: true } },
  shift: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      businessDate: true,
      status: true,
    },
  },
  workSession: {
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      workedMinutes: true,
      breakMinutes: true,
      status: true,
      shiftId: true,
    },
  },
  resolvedBy: { select: { name: true, username: true } },
} as const;

const shiftInclude = {
  employment: {
    select: { employee: { select: { displayName: true } } },
  },
  branch: { select: { id: true, name: true, timezone: true } },
} as const;

const sessionInclude = {
  employment: {
    select: { employee: { select: { displayName: true } } },
  },
  branch: { select: { id: true, name: true, timezone: true } },
} as const;

const allowedStatuses = new Set<AttendanceStatusFilter>([
  "ALL",
  "OPEN",
  "RESOLVED",
  "DISMISSED",
]);
const allowedIncidenceFilters = new Set<AttendanceIncidenceFilter>([
  "ALL",
  "WITH",
  "WITHOUT",
]);

function statusForIssues(
  issues: Array<{ status: "OPEN" | "RESOLVED" | "DISMISSED" }>,
): AttendanceOccurrenceStatus {
  if (!issues.length) return "NONE";
  if (issues.some((issue) => issue.status === "OPEN")) return "OPEN";
  if (issues.some((issue) => issue.status === "RESOLVED")) return "RESOLVED";
  return "DISMISSED";
}

function occurrenceRank(item: AttendanceOccurrence) {
  if (item.status === "OPEN") return 0;
  if (item.status === "NONE") return 1;
  return 2;
}

export async function getAttendanceCenter(
  actor: AttendanceActor,
  input: {
    start: Date;
    end: Date;
    branchId?: string;
    status?: AttendanceStatusFilter;
    incidence?: AttendanceIncidenceFilter;
    now?: Date;
  },
) {
  if (input.start > input.end) throw new Error("Rango de fechas inválido.");
  if (input.end.getTime() - input.start.getTime() > 93 * 86_400_000)
    throw new Error("El rango máximo es de 93 días.");
  const status = input.status ?? "ALL";
  const incidence = input.incidence ?? "ALL";
  if (!allowedStatuses.has(status)) throw new Error("Estado inválido.");
  if (!allowedIncidenceFilters.has(incidence))
    throw new Error("Filtro de incidencias inválido.");
  if (
    input.branchId &&
    !canAccessAttendanceBranch(
      actor.role,
      actor.accessibleBranchIds,
      input.branchId,
    )
  )
    throw new Error("Sucursal no autorizada.");

  const branchIds = input.branchId
    ? [input.branchId]
    : actor.role === "ADMIN"
      ? undefined
      : (actor.accessibleBranchIds ?? []);
  const now = input.now ?? new Date();
  await reconcileAttendanceScope({
    start: input.start,
    end: input.end,
    now,
    branchIds,
  });

  const scope = branchIds ? { branchId: { in: branchIds } } : {};
  const exceptionWhere: Prisma.AttendanceExceptionWhereInput = {
    businessDate: { gte: input.start, lte: input.end },
    ...scope,
    branch: { active: true },
    employment: operationalEmploymentWhere,
    type: { notIn: [...HIDDEN_ATTENDANCE_TYPES] },
  };
  const [exceptions, shifts, sessions, branches] = await Promise.all([
    prisma.attendanceException.findMany({
      where: exceptionWhere,
      include: exceptionInclude,
      orderBy: [{ status: "asc" }, { detectedAt: "asc" }],
    }),
    prisma.shift.findMany({
      where: {
        businessDate: { gte: input.start, lte: input.end },
        ...scope,
        branch: { active: true },
        employmentId: { not: null },
        employment: operationalEmploymentWhere,
        status: { in: ["PUBLISHED", "CANCELLED"] },
      },
      include: shiftInclude,
      orderBy: [{ businessDate: "asc" }, { startAt: "asc" }],
    }),
    prisma.workSession.findMany({
      where: {
        businessDate: { gte: input.start, lte: input.end },
        ...scope,
        branch: { active: true },
        employment: operationalEmploymentWhere,
      },
      include: sessionInclude,
      orderBy: [{ businessDate: "asc" }, { startedAt: "asc" }],
    }),
    prisma.branch.findMany({
      where: {
        active: true,
        ...(branchIds ? { id: { in: branchIds } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, timezone: true },
    }),
  ]);

  type Issue = (typeof exceptions)[number];
  type ShiftRecord = (typeof shifts)[number];
  type SessionRecord = (typeof sessions)[number];
  const issuesByShift = new Map<string, Issue[]>();
  const issuesBySession = new Map<string, Issue[]>();
  for (const issue of exceptions) {
    if (issue.shiftId) {
      const list = issuesByShift.get(issue.shiftId) ?? [];
      list.push(issue);
      issuesByShift.set(issue.shiftId, list);
    }
    if (issue.workSessionId) {
      const list = issuesBySession.get(issue.workSessionId) ?? [];
      list.push(issue);
      issuesBySession.set(issue.workSessionId, list);
    }
  }
  const sessionsByShift = new Map<string, SessionRecord[]>();
  for (const session of sessions) {
    if (!session.shiftId) continue;
    const list = sessionsByShift.get(session.shiftId) ?? [];
    list.push(session);
    sessionsByShift.set(session.shiftId, list);
  }
  const shiftById = new Map<string, ShiftRecord>(
    shifts.map((shift) => [shift.id, shift]),
  );
  const seenSessions = new Set<string>();

  const buildOccurrence = (
    shift: ShiftRecord | null,
    session: SessionRecord | null,
    fallbackIssue?: Issue,
  ): AttendanceOccurrence | null => {
    const related = new Map<string, Issue>();
    for (const issue of [
      ...(shift ? issuesByShift.get(shift.id) ?? [] : []),
      ...(session ? issuesBySession.get(session.id) ?? [] : []),
      ...(fallbackIssue ? [fallbackIssue] : []),
    ])
      related.set(issue.id, issue);
    const issueList = [...related.values()];
    const branch = session?.branch ?? shift?.branch ?? issueList[0]?.branch;
    const businessDate =
      session?.businessDate ?? shift?.businessDate ?? issueList[0]?.businessDate;
    if (!branch || !businessDate) return null;
    const employeeName =
      session?.employment.employee.displayName ??
      shift?.employment?.employee.displayName ??
      issueList[0]?.employment.employee.displayName ??
      "Empleado";
    const issueTypes = [...new Set(issueList.map((issue) => issue.type))];
    const openIssues = issueList.filter((issue) => issue.status === "OPEN");
    const status = statusForIssues(issueList);
    const state: AttendanceOccurrenceState = openIssues.length
      ? "ATTENTION"
      : issueList.length
        ? "REVIEWED"
        : session
          ? session.endedAt
            ? "COMPLETED"
            : "WORKING"
          : "WAITING";
    const scheduledStart =
      shift?.startAt ?? issueList.find((issue) => issue.scheduledStart)?.scheduledStart ?? null;
    const scheduledEnd =
      shift?.endAt ?? issueList.find((issue) => issue.scheduledEnd)?.scheduledEnd ?? null;
    const actualStart =
      session?.startedAt ?? issueList.find((issue) => issue.actualStart)?.actualStart ?? null;
    const actualEnd =
      session?.endedAt ?? issueList.find((issue) => issue.actualEnd)?.actualEnd ?? null;
    const primary = openIssues[0] ?? issueList[0] ?? null;
    const correctionTypes = new Set([
      "MISSING_CLOCK_IN",
      "MISSING_CLOCK_OUT",
      "MISSING_PUNCH",
    ]);
    return {
      id: session
        ? `session:${session.id}`
        : `shift:${shift?.id ?? fallbackIssue?.id ?? "unknown"}`,
      employeeName,
      branchId: branch.id,
      branchName: branch.name,
      branchTimezone: branch.timezone,
      businessDate,
      scheduledStart,
      scheduledEnd,
      actualStart,
      actualEnd,
      workedMinutes: session?.workedMinutes ?? null,
      differenceMinutes:
        issueList.find((issue) => issue.differenceMinutes !== null)?.differenceMinutes ?? null,
      issueTypes,
      status,
      state,
      workSessionId: session?.id ?? issueList[0]?.workSessionId ?? null,
      primaryExceptionId: primary?.id ?? null,
      resolution: primary?.resolution ?? null,
      resolvedAt: primary?.resolvedAt ?? null,
      resolvedByName: primary?.resolvedBy
        ? primary.resolvedBy.name ?? primary.resolvedBy.username
        : null,
      action: openIssues.length
        ? issueTypes.some((type) => correctionTypes.has(type))
          ? "CORRECT"
          : "REVIEW"
        : session
          ? "HOURS"
          : null,
    };
  };

  const occurrences: AttendanceOccurrence[] = [];
  for (const shift of shifts.filter((item) => item.status === "PUBLISHED")) {
    const relatedSessions = sessionsByShift.get(shift.id) ?? [];
    if (!relatedSessions.length) {
      const occurrence = buildOccurrence(shift, null);
      if (occurrence) occurrences.push(occurrence);
      continue;
    }
    for (const session of relatedSessions) {
      seenSessions.add(session.id);
      const occurrence = buildOccurrence(shift, session);
      if (occurrence) occurrences.push(occurrence);
    }
  }
  for (const session of sessions) {
    if (seenSessions.has(session.id)) continue;
    const occurrence = buildOccurrence(shiftById.get(session.shiftId ?? "") ?? null, session);
    if (occurrence) occurrences.push(occurrence);
  }

  const filtered = occurrences
    .filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (incidence === "WITH" && !item.issueTypes.length) return false;
      if (incidence === "WITHOUT" && item.issueTypes.length) return false;
      return true;
    })
    .sort(
      (a, b) =>
        occurrenceRank(a) - occurrenceRank(b) ||
        a.businessDate.getTime() - b.businessDate.getTime() ||
        (a.scheduledStart?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.scheduledStart?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        a.employeeName.localeCompare(b.employeeName),
    );
  const today = localBusinessDate(now, "America/Mexico_City");
  const todayKey = dateKey(today);
  const open = occurrences.filter((item) => item.status === "OPEN");
  const byType = new Map<string, number>();
  for (const item of open)
    for (const type of item.issueTypes)
      byType.set(type, (byType.get(type) ?? 0) + 1);

  return {
    items: filtered,
    attention: filtered.filter((item) => item.status === "OPEN"),
    reviewed: filtered.filter(
      (item) => item.status !== "OPEN" && item.issueTypes.length > 0,
    ),
    normal: filtered.filter((item) => item.status === "NONE"),
    branches,
    summary: {
      workingNow: occurrences.filter(
        (item) => item.state === "WORKING" && dateKey(item.businessDate) === todayKey,
      ).length,
      completed: occurrences.filter(
        (item) => item.state === "COMPLETED" && dateKey(item.businessDate) === todayKey,
      ).length,
      incidents: open.length,
      noShows: open.filter((item) => item.issueTypes.includes("NO_SHOW")).length,
      normal: occurrences.filter((item) => item.status === "NONE").length,
      byType: Object.fromEntries(byType),
    },
  };
}
