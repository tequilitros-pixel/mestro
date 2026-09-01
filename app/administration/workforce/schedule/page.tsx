import { getAccessibleBranchIds, requireModuleAccess } from "@/lib/auth";
import { dateOnly } from "@/lib/workforce/availability/rules";
import { dateKey, DAY_MS } from "@/lib/workforce/scheduling/rules";
import { getPreviousWeekSchedulePreview, getPublicationValidation, getScheduleBoard, listSchedulingBranches, type SchedulingActor } from "@/lib/workforce/scheduling/service";
import { ScheduleExperience, type ScheduleViewModel } from "./ScheduleExperience";

function monday(value?: string) {
  const date = dateOnly(value ?? new Date());
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}

export default async function WorkforceSchedulePage({ searchParams }: { searchParams: Promise<{ branch?: string; week?: string; day?: string; saved?: string; error?: string }> }) {
  const user = await requireModuleAccess("/administration/schedule");
  const actor: SchedulingActor = { id: user.id, role: user.role, accessibleBranchIds: await getAccessibleBranchIds() };
  const query = await searchParams;
  const branches = await listSchedulingBranches(actor);
  const branchId = query.branch && branches.some((branch) => branch.id === query.branch) ? query.branch : branches[0]?.id;
  if (!branchId) return <div className="rounded-2xl border border-outline-variant bg-surface p-6">No tienes sucursales autorizadas para programar horarios.</div>;

  const start = monday(query.week);
  const [board, validation, previous] = await Promise.all([getScheduleBoard(actor, branchId, start), getPublicationValidation(actor, branchId, start), getPreviousWeekSchedulePreview(actor, branchId, start)]);
  const shifts = board.period?.shifts ?? [];
  const formatTime = (value: Date) => new Intl.DateTimeFormat("es-MX", { timeZone: board.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
  const model: ScheduleViewModel = {
    branchId,
    branches: branches.map(({ id, name }) => ({ id, name })),
    weekStart: dateKey(start), weekEnd: dateKey(board.end), selectedDay: query.day ?? dateKey(start),
    timezone: board.timezone, threshold: board.threshold, notice: query.saved ?? null, error: query.error ?? null,
    period: board.period ? { id: board.period.id, published: board.period.status === "PUBLISHED", lastPublishedAt: board.period.publications[0]?.publishedAt.toISOString() ?? null } : null,
    employments: board.employments.map((employment) => ({ id: employment.id, name: employment.employee.displayName ?? "Sin nombre", hours: board.hours.get(employment.id) ?? 0 })),
    shifts: shifts.map((shift) => ({
      id: shift.id, periodId: shift.schedulePeriodId, employmentId: shift.employmentId,
      employeeName: shift.employment?.employee.displayName ?? null, date: dateKey(shift.businessDate),
      start: formatTime(shift.startAt), end: formatTime(shift.endAt), breakMinutes: shift.expectedBreakMinutes,
      version: shift.version, cancelled: shift.status === "CANCELLED", warnings: board.shiftWarnings.get(shift.id) ?? [],
      revisions: shift.revisions.map((revision) => ({ id: revision.id, reason: revision.reason, by: revision.changedBy.name, at: revision.changedAt.toISOString() })),
    })),
    availability: Array.from(board.availability, ([key, value]) => ({ key, state: value.state, startTime: value.startTime, endTime: value.endTime })),
    coverage: board.coverage.map((item) => ({ id: item.id, date: dateKey(item.businessDate), start: item.startTime, end: item.endTime, required: item.requiredCount, scheduled: item.scheduled, gap: item.gap, status: item.status })),
    blockers: validation.blockers, warningCount: validation.warnings.length,
    previousWeek: {
      weekStart: dateKey(previous.weekStart),
      shifts: previous.shifts.map((shift) => ({
        id: shift.id,
        employeeName: shift.employment?.employee.displayName ?? "Sin asignar",
        dayOffset: Math.round((shift.businessDate.getTime() - previous.weekStart.getTime()) / DAY_MS),
        start: formatTime(shift.startAt),
        end: formatTime(shift.endAt),
      })),
    },
  };
  return <ScheduleExperience model={model} />;
}
