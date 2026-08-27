import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getAccessibleBranchIds, requireModuleAccess } from "@/lib/auth";
import {
  copyWorkforcePreviousWeekAction,
  deleteWorkforceShiftAction,
  ensureWorkforceSchedulePeriodAction,
  publishWorkforceScheduleAction,
  saveWorkforceCoverageAction,
  saveWorkforceShiftAction,
} from "@/app/actions/workforceScheduling";
import { dateOnly } from "@/lib/workforce/availability/rules";
import { dateKey, DAY_MS } from "@/lib/workforce/scheduling/rules";
import {
  getPublicationValidation,
  getScheduleBoard,
  listSchedulingBranches,
  type SchedulingActor,
} from "@/lib/workforce/scheduling/service";

const field =
  "w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-sm";
const button =
  "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary";
const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
function monday(value: string | undefined) {
  const date = dateOnly(value ?? new Date());
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}
function time(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
function returnTo(branchId: string, week: string, day?: string) {
  return `/administration/workforce-v1/schedule?branch=${branchId}&week=${week}${day ? `&day=${day}` : ""}`;
}

export default async function WorkforceSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    branch?: string;
    week?: string;
    day?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const user = await requireModuleAccess("/administration/schedule");
  const actor: SchedulingActor = {
    id: user.id,
    role: user.role,
    accessibleBranchIds: await getAccessibleBranchIds(),
  };
  const query = await searchParams;
  const branches = await listSchedulingBranches(actor);
  const branchId =
    query.branch && branches.some((item) => item.id === query.branch)
      ? query.branch
      : branches[0]?.id;
  const start = monday(query.week);
  const week = dateKey(start);
  const selectedDay = query.day ?? week;
  if (!branchId)
    return <Card>No tienes sucursales autorizadas para Scheduling.</Card>;
  const board = await getScheduleBoard(actor, branchId, start);
  const publicationValidation = await getPublicationValidation(
    actor,
    branchId,
    start,
  );
  const target = returnTo(branchId, week, selectedDay);
  const dates = Array.from(
    { length: 7 },
    (_, index) => new Date(start.getTime() + index * DAY_MS),
  );
  const shifts = board.period?.shifts ?? [];
  const warningCount = publicationValidation.warnings.length;
  return (
    <section className="space-y-5">
      {query.saved && (
        <div
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold"
        >
          {query.saved}
        </div>
      )}
      {query.error && (
        <div
          role="alert"
          className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm font-semibold text-error"
        >
          {query.error}
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Horario semanal</h2>
          <p className="text-sm text-on-surface-variant">
            Trabajo planeado · {dateKey(start)} → {dateKey(board.end)}
          </p>
        </div>
        <form className="flex flex-wrap gap-2">
          <select
            aria-label="Sucursal"
            name="branch"
            defaultValue={branchId}
            className={field}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Semana"
            name="week"
            type="date"
            defaultValue={week}
            className={field}
          />
          <button className={button}>Abrir</button>
        </form>
      </div>
      {!board.period ? (
        <Card>
          <h3 className="font-bold">No existe borrador para esta semana</h3>
          <p className="mb-3 text-sm text-on-surface-variant">
            Crea el periodo Branch + Week para comenzar.
          </p>
          <form action={ensureWorkforceSchedulePeriodAction}>
            <input type="hidden" name="branchId" value={branchId} />
            <input type="hidden" name="weekStart" value={week} />
            <input type="hidden" name="returnTo" value={target} />
            <button className={button}>Crear semana DRAFT</button>
          </form>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card>
              <p className="text-xs text-on-surface-variant">Estado</p>
              <strong>{board.period.status}</strong>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Shifts</p>
              <strong>{shifts.length}</strong>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Empleados</p>
              <strong>
                {
                  new Set(
                    shifts.map((item) => item.employmentId).filter(Boolean),
                  ).size
                }
              </strong>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Warnings</p>
              <strong>{warningCount}</strong>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Blockers</p>
              <strong>{publicationValidation.blockers.length}</strong>
            </Card>
          </div>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Acciones de semana</h3>
                <p className="text-xs text-on-surface-variant">
                  Publicación completa, transaccional e idempotente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={copyWorkforcePreviousWeekAction}>
                  <input
                    type="hidden"
                    name="periodId"
                    value={board.period.id}
                  />
                  <input type="hidden" name="returnTo" value={target} />
                  <button
                    disabled={board.period.status !== "DRAFT"}
                    className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Copy previous week
                  </button>
                </form>
                <form action={publishWorkforceScheduleAction}>
                  <input
                    type="hidden"
                    name="periodId"
                    value={board.period.id}
                  />
                  <input type="hidden" name="returnTo" value={target} />
                  <button
                    disabled={publicationValidation.blockers.length > 0}
                    className={`${button} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Publicar semana
                  </button>
                </form>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 font-bold">Crear turno</h3>
            <form
              action={saveWorkforceShiftAction}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7"
            >
              <input type="hidden" name="periodId" value={board.period.id} />
              <input type="hidden" name="returnTo" value={target} />
              <label className="text-xs">
                Fecha
                <input
                  required
                  name="businessDate"
                  type="date"
                  min={week}
                  max={dateKey(board.end)}
                  defaultValue={selectedDay}
                  className={field}
                />
              </label>
              <label className="text-xs">
                Employee
                <select name="employmentId" className={field}>
                  <option value="">Sin asignar</option>
                  {board.employments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.employee.displayName ?? "Sin nombre"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Inicio
                <input
                  required
                  name="startTime"
                  type="time"
                  defaultValue="09:00"
                  className={field}
                />
              </label>
              <label className="text-xs">
                Fin
                <input
                  required
                  name="endTime"
                  type="time"
                  defaultValue="17:00"
                  className={field}
                />
              </label>
              <label className="text-xs">
                Break min
                <input
                  name="expectedBreakMinutes"
                  type="number"
                  min="0"
                  defaultValue="30"
                  className={field}
                />
              </label>
              <label className="text-xs lg:col-span-2">
                Razón si ya publicado
                <input name="reason" maxLength={200} className={field} />
              </label>
              <button className={`${button} sm:col-span-2 lg:col-span-7`}>
                Guardar turno
              </button>
            </form>
          </Card>
          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[1100px] rounded-xl border border-outline-variant">
              <div className="grid grid-cols-[14rem_repeat(7,minmax(7rem,1fr))] bg-surface-container text-xs font-bold">
                <div className="p-3">Employee / horas</div>
                {dates.map((date, index) => (
                  <div
                    key={dateKey(date)}
                    className="border-l border-outline-variant p-3"
                  >
                    {days[index]} {date.getUTCDate()}
                  </div>
                ))}
              </div>
              {board.employments.map((employment) => (
                <div
                  key={employment.id}
                  className="grid grid-cols-[14rem_repeat(7,minmax(7rem,1fr))] border-t border-outline-variant"
                >
                  <div className="p-3">
                    <strong>{employment.employee.displayName}</strong>
                    <p className="text-xs text-on-surface-variant">
                      {(board.hours.get(employment.id) ?? 0).toFixed(1)} h /{" "}
                      {board.threshold} h
                    </p>
                  </div>
                  {dates.map((date) => (
                    <div
                      key={dateKey(date)}
                      className="min-h-24 space-y-2 border-l border-outline-variant p-2"
                    >
                      {shifts
                        .filter(
                          (shift) =>
                            shift.employmentId === employment.id &&
                            dateKey(shift.businessDate) === dateKey(date),
                        )
                        .map((shift) => (
                          <ShiftEditor
                            key={shift.id}
                            shift={shift}
                            timezone={board.timezone}
                            target={target}
                            warnings={board.shiftWarnings.get(shift.id) ?? []}
                            employments={board.employments}
                          />
                        ))}
                      <p className="text-[10px] text-on-surface-variant">
                        {board.availability.get(
                          `${employment.id}|${dateKey(date)}`,
                        )?.state ?? "UNKNOWN"}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 lg:hidden">
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((date, index) => (
                <Link
                  key={dateKey(date)}
                  href={returnTo(branchId, week, dateKey(date))}
                  className={`min-w-14 rounded-lg border p-2 text-center text-xs font-bold ${selectedDay === dateKey(date) ? "border-primary bg-primary/10" : "border-outline-variant"}`}
                >
                  {days[index]}
                  <span className="block text-base">{date.getUTCDate()}</span>
                </Link>
              ))}
            </nav>
            {shifts.filter(
              (shift) => dateKey(shift.businessDate) === selectedDay,
            ).length ? (
              shifts
                .filter((shift) => dateKey(shift.businessDate) === selectedDay)
                .map((shift) => (
                  <ShiftEditor
                    key={shift.id}
                    shift={shift}
                    timezone={board.timezone}
                    target={target}
                    warnings={board.shiftWarnings.get(shift.id) ?? []}
                    employments={board.employments}
                  />
                ))
            ) : (
              <Card>Sin shifts este día.</Card>
            )}
          </div>
          {shifts.filter((item) => !item.employmentId).length > 0 && (
            <Card>
              <h3 className="font-bold">Turnos sin asignar</h3>
              <p className="text-sm text-on-surface-variant">
                {shifts.filter((item) => !item.employmentId).length} shift(s)
                requieren Employee antes o después de publicar.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shifts
                  .filter((item) => !item.employmentId)
                  .map((shift) => (
                    <ShiftEditor
                      key={shift.id}
                      shift={shift}
                      timezone={board.timezone}
                      target={target}
                      warnings={board.shiftWarnings.get(shift.id) ?? []}
                      employments={board.employments}
                    />
                  ))}
              </div>
            </Card>
          )}
          <Card>
            <h3 className="mb-3 font-bold">Cobertura manual</h3>
            <form
              action={saveWorkforceCoverageAction}
              className="grid gap-2 sm:grid-cols-5"
            >
              <input type="hidden" name="branchId" value={branchId} />
              <input type="hidden" name="returnTo" value={target} />
              <input
                aria-label="Fecha cobertura"
                required
                name="businessDate"
                type="date"
                min={week}
                max={dateKey(board.end)}
                defaultValue={selectedDay}
                className={field}
              />
              <input
                aria-label="Inicio cobertura"
                required
                name="startTime"
                type="time"
                defaultValue="18:00"
                className={field}
              />
              <input
                aria-label="Fin cobertura"
                required
                name="endTime"
                type="time"
                defaultValue="23:00"
                className={field}
              />
              <input
                aria-label="Required"
                required
                name="requiredCount"
                type="number"
                min="1"
                defaultValue="1"
                className={field}
              />
              <button className={button}>Guardar target</button>
            </form>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {board.coverage.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-outline-variant p-3 text-sm"
                >
                  <strong>
                    {dateKey(item.businessDate)} · {item.startTime}–
                    {item.endTime}
                  </strong>
                  <p>
                    Required: {item.requiredCount} · Scheduled: {item.scheduled}{" "}
                    · Gap: {item.gap}
                  </p>
                  <p className="font-bold">{item.status}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 font-bold">Publicaciones</h3>
            {board.period.publications.length ? (
              board.period.publications.map((publication) => (
                <p key={publication.id} className="text-sm">
                  Versión {publication.version} ·{" "}
                  {publication.publishedAt.toISOString()}
                </p>
              ))
            ) : (
              <p className="text-sm text-on-surface-variant">
                Aún no publicada.
              </p>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

type Board = Awaited<ReturnType<typeof getScheduleBoard>>;
function ShiftEditor({
  shift,
  timezone,
  target,
  warnings,
  employments,
}: {
  shift: NonNullable<Board["period"]>["shifts"][number];
  timezone: string;
  target: string;
  warnings: string[];
  employments: Board["employments"];
}) {
  return (
    <details className="rounded-lg border border-outline-variant bg-surface p-2 text-xs">
      <summary className="cursor-pointer font-bold">
        {time(shift.startAt, timezone)}–{time(shift.endAt, timezone)} ·{" "}
        {shift.employment?.employee.displayName ?? "Sin asignar"}
        {shift.status === "CANCELLED" ? " · CANCELLED" : ""}
      </summary>
      {warnings.length > 0 && (
        <p className="mt-1 font-semibold text-secondary">
          {warnings.join(" · ")}
        </p>
      )}
      <form action={saveWorkforceShiftAction} className="mt-2 space-y-2">
        <input type="hidden" name="periodId" value={shift.schedulePeriodId} />
        <input type="hidden" name="shiftId" value={shift.id} />
        <input type="hidden" name="expectedVersion" value={shift.version} />
        <input type="hidden" name="returnTo" value={target} />
        <input
          name="businessDate"
          type="date"
          defaultValue={dateKey(shift.businessDate)}
          className={field}
        />
        <select
          name="employmentId"
          defaultValue={shift.employmentId ?? ""}
          className={field}
        >
          <option value="">Sin asignar</option>
          {employments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.employee.displayName}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-1">
          <input
            aria-label="Inicio turno"
            name="startTime"
            type="time"
            defaultValue={time(shift.startAt, timezone)}
            className={field}
          />
          <input
            aria-label="Fin turno"
            name="endTime"
            type="time"
            defaultValue={time(shift.endAt, timezone)}
            className={field}
          />
        </div>
        <input
          name="expectedBreakMinutes"
          type="number"
          min="0"
          defaultValue={shift.expectedBreakMinutes}
          className={field}
        />
        <input
          name="reason"
          placeholder="Razón obligatoria post-publicación"
          className={field}
        />
        <button className={button}>Guardar cambio</button>
      </form>
      <form action={deleteWorkforceShiftAction} className="mt-2">
        <input type="hidden" name="shiftId" value={shift.id} />
        <input type="hidden" name="expectedVersion" value={shift.version} />
        <input type="hidden" name="returnTo" value={target} />
        <input
          name="reason"
          placeholder="Razón para cancelar"
          className={field}
        />
        <button className="mt-1 rounded-lg border border-error/30 px-2 py-1 font-semibold text-error">
          {shift.status === "DRAFT" ? "Eliminar draft" : "Cancelar"}
        </button>
      </form>
      {shift.revisions.length > 0 && (
        <div className="mt-2 border-t border-outline-variant pt-2">
          <strong>Historia</strong>
          {[...shift.revisions].reverse().map((revision) => (
            <p key={revision.id}>
              v{revision.revisionNumber}: {time(revision.startAt, timezone)}–
              {time(revision.endAt, timezone)} · {revision.status}
              <br />
              {revision.reason} · {revision.changedBy.name} ·{" "}
              {revision.changedAt.toISOString()}
            </p>
          ))}
        </div>
      )}
    </details>
  );
}
