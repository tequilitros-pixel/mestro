import { getAccessibleBranchIds, requireModuleAccess } from "@/lib/auth";
import { dateOnly } from "@/lib/workforce/availability/rules";
import { dateKey, DAY_MS } from "@/lib/workforce/scheduling/rules";
import { getGlobalScheduleBoard, type SchedulingActor } from "@/lib/workforce/scheduling/service";
import { ScheduleExperience, type ScheduleViewModel } from "./ScheduleExperience";

function monday(value?: string) {
  const date = dateOnly(value ?? new Date());
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}

export default async function WorkforceSchedulePage({ searchParams }: { searchParams: Promise<{ branch?: string; week?: string; day?: string; saved?: string; error?: string }> }) {
  const user = await requireModuleAccess("/administration/schedule");
  const actor: SchedulingActor = { id: user.id, role: user.role, accessibleBranchIds: await getAccessibleBranchIds() };
  const query = await searchParams;
  const start = monday(query.week);
  const requestedBranch = query.branch && query.branch !== "all" ? query.branch : null;
  const board = await getGlobalScheduleBoard(actor, requestedBranch, start);
  if (!board.branches.length) return <div className="rounded-2xl border border-outline-variant bg-surface p-6">No tienes sucursales autorizadas para programar horarios.</div>;

  const branchById = new Map(board.branches.map((branch) => [branch.id, branch]));
  const formatTime = (value: Date, branchId: string) => new Intl.DateTimeFormat("es-MX", {
    timeZone: branchById.get(branchId)?.timezone ?? board.companyTimezone,
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(value);
  const previousStart = new Date(start.getTime() - 7 * DAY_MS);
  const allShifts = board.periods.flatMap((period) => period.shifts);
  const model: ScheduleViewModel = {
    selectedBranchId: requestedBranch,
    branches: board.branches.map(({ id, name, color, timezone }) => ({ id, name, color, timezone })),
    weekStart: dateKey(start), weekEnd: dateKey(board.end), selectedDay: query.day ?? dateKey(start),
    threshold: board.threshold, notice: query.saved ?? null, error: query.error ?? null,
    periods: board.periods.map((period) => ({
      id: period.id, branchId: period.branchId, published: period.status === "PUBLISHED",
      lastPublishedAt: period.publications[0]?.publishedAt.toISOString() ?? null,
      shiftCount: period.shifts.filter((shift) => shift.status !== "CANCELLED").length,
    })),
    employments: board.employments.map((employment) => ({
      id: employment.id, name: employment.employee.displayName ?? "Sin nombre", hours: board.hours.get(employment.id) ?? 0,
      assignments: employment.branchAssignments.map((assignment) => ({ branchId: assignment.branchId, branchName: assignment.branch.name, type: assignment.type })),
    })),
    shifts: allShifts.map((shift) => ({
      id: shift.id, periodId: shift.schedulePeriodId, branchId: shift.branchId, branchName: shift.branch.name, branchColor: shift.branch.color,
      employmentId: shift.employmentId, employeeName: shift.employment?.employee.displayName ?? null, date: dateKey(shift.businessDate),
      start: formatTime(shift.startAt, shift.branchId), end: formatTime(shift.endAt, shift.branchId), breakMinutes: shift.expectedBreakMinutes,
      version: shift.version, cancelled: shift.status === "CANCELLED", warnings: board.shiftWarnings.get(shift.id) ?? [],
      revisions: shift.revisions.map((revision) => ({ id: revision.id, reason: revision.reason, by: revision.changedBy.name, at: revision.changedAt.toISOString() })),
    })),
    availability: Array.from(board.availability, ([key, value]) => ({ key, state: value.state, startTime: value.startTime, endTime: value.endTime })),
    coverage: board.coverage.map((item) => ({
      id: item.id, branchId: item.branchId, branchName: item.branch.name, date: dateKey(item.businessDate), start: item.startTime, end: item.endTime,
      required: item.requiredCount, scheduled: item.scheduled, gap: item.gap, status: item.status,
    })),
    previousWeek: {
      weekStart: dateKey(previousStart),
      branches: board.previousPeriods.map((period) => ({
        branchId: period.branchId,
        shifts: period.shifts.map((shift) => ({
          id: shift.id, employeeName: shift.employment?.employee.displayName ?? "Sin asignar",
          dayOffset: Math.round((shift.businessDate.getTime() - previousStart.getTime()) / DAY_MS),
          start: formatTime(shift.startAt, period.branchId), end: formatTime(shift.endAt, period.branchId),
        })),
      })),
    },
  };
  return <ScheduleExperience model={model} />;
}
