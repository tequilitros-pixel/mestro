import { workforceToday } from "@/lib/workforce/businessDate";
import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { getTimesheetBoard } from "@/lib/workforce/timesheet/service";
import { dateKey, formatMinutes, mondayOf, timesheetReadiness } from "@/lib/workforce/timesheet/rules";
import {
  attendanceTypeLabels,
  clockEventLabels,
  humanLabel,
  timesheetReadinessLabels,
  timesheetStatusLabels,
} from "@/lib/workforce/presentation";
import { workforceAdminClockCorrectionAction } from "@/app/actions/workforceClock";
import {
  workforceTimesheetAdjustmentAction,
  workforceTimesheetApprovalAction,
  workforceTimesheetRequestReviewAction,
  workforceTimesheetLockAction,
} from "@/app/actions/workforceTimesheet";

const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const parseWeek = (value: string | undefined, today: Date) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? mondayOf(new Date(`${value}T00:00:00.000Z`))
    : mondayOf(today);
const readiness = (sheet: Awaited<ReturnType<typeof getTimesheetBoard>>["sheets"][number]) =>
  timesheetReadiness(
    sheet.lines.map((line) => ({
      needsReview: line.needsReview,
      blocking: line.workSessionLinks.some(
        (link) =>
          link.workSession.status !== "COMPLETE" ||
          link.workSession.attendanceExceptions.some(
            (issue) =>
              issue.status === "OPEN" &&
              issue.severity === "CRITICAL" &&
              ["MISSING_CLOCK_IN", "MISSING_CLOCK_OUT", "INCOMPLETE_BREAK"].includes(issue.type),
          ),
      ),
    })),
  );

type BoardSheet = Awaited<ReturnType<typeof getTimesheetBoard>>["sheets"][number];
type WorkSession = BoardSheet["lines"][number]["workSessionLinks"][number]["workSession"];
type ClockEvent = WorkSession["clockEventLinks"][number]["clockEvent"];
const localMoment = (value: Date | null | undefined, timezone: string | null | undefined) =>
  value
    ? value.toLocaleTimeString("es-MX", {
        timeZone: timezone ?? "America/Mexico_City",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Sin registrar";
const inputMoment = (value: Date | null | undefined) => value?.toISOString().slice(0, 16) ?? "";
const defaultMoment = (day: Date, hour: number) => `${dateKey(day)}T${String(hour).padStart(2, "0")}:00`;

function ClockCorrectionForm({
  event,
  employmentId,
  returnTo,
}: {
  event: ClockEvent;
  employmentId: string;
  returnTo: string;
}) {
  return (
    <form action={workforceAdminClockCorrectionAction} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="employmentId" value={employmentId} />
      <input type="hidden" name="type" value="MODIFY_OCCURRED_TIME" />
      <input type="hidden" name="targetClockEventId" value={event.id} />
      <input
        required
        name="proposedOccurredAt"
        type="datetime-local"
        defaultValue={inputMoment(event.deviceOccurredAt)}
        aria-label={`Nueva hora de ${humanLabel(clockEventLabels, event.type)}`}
        className="min-h-10 rounded-lg border bg-surface px-2 text-sm"
      />
      <input required minLength={5} name="reason" placeholder="Motivo del cambio" className="min-h-10 rounded-lg border bg-surface px-2 text-sm" />
      <button className="min-h-10 rounded-lg border border-primary px-3 text-sm font-bold text-primary">Guardar cambio</button>
    </form>
  );
}

function MissingEventForm({
  employmentId,
  branchId,
  day,
  proposedEventType,
  returnTo,
  label,
  hour,
}: {
  employmentId: string;
  branchId: string;
  day: Date;
  proposedEventType: string;
  returnTo: string;
  label: string;
  hour: number;
}) {
  return (
    <form action={workforceAdminClockCorrectionAction} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="employmentId" value={employmentId} />
      <input type="hidden" name="type" value="ADD_MISSING_EVENT" />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="proposedEventType" value={proposedEventType} />
      <input required name="proposedOccurredAt" type="datetime-local" defaultValue={defaultMoment(day, hour)} aria-label={label} className="min-h-10 rounded-lg border bg-surface px-2 text-sm" />
      <input required minLength={5} name="reason" placeholder="Motivo del evento faltante" className="min-h-10 rounded-lg border bg-surface px-2 text-sm" />
      <button className="min-h-10 rounded-lg border border-primary px-3 text-sm font-bold text-primary">{label}</button>
    </form>
  );
}

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [user, query] = await Promise.all([requireAdmin(), searchParams]);
  const week = parseWeek(query.week, await workforceToday());
  const status = ["OPEN", "REVIEW", "APPROVED", "LOCKED"].includes(query.status ?? "") ? query.status : undefined;
  const board = await getTimesheetBoard(
    { id: user.id, role: user.role, accessibleBranchIds: null },
    week,
    query.search || undefined,
    status,
    query.branch || undefined,
  );
  const back = `/administration/workforce/timesheets?week=${dateKey(board.start)}${query.search ? `&search=${encodeURIComponent(query.search)}` : ""}${query.branch ? `&branch=${encodeURIComponent(query.branch)}` : ""}${status ? `&status=${status}` : ""}`;
  return (
    <section className="space-y-4">
      {query.saved ? <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">{query.saved}</p> : null}
      {query.error ? <p role="alert" className="rounded-xl bg-error/10 p-3 text-error">{query.error}</p> : null}
      <div><h2 className="text-2xl font-black">Horas trabajadas</h2><p className="text-sm text-on-surface-variant">Revisa jornadas, incidencias y aprobación de lunes a domingo.</p></div>
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">Semana<input name="week" type="date" defaultValue={dateKey(board.start)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Sucursal<select name="branch" defaultValue={query.branch ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todas</option>{board.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-sm">Empleado<input name="search" defaultValue={query.search ?? ""} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Estado<select name="status" defaultValue={status ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todos</option><option value="OPEN">Pendiente</option><option value="REVIEW">En revisión</option><option value="APPROVED">Aprobado</option><option value="LOCKED">Bloqueado para nómina</option></select></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary sm:col-span-4">Abrir periodo</button>
        </form>
      </Card>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
          <thead><tr><th className="p-2 text-left">Empleado</th>{days.map((day) => <th key={day} className="p-2 text-right">{day}</th>)}<th className="p-2 text-right">Total</th><th className="p-2">Incidencias</th><th className="p-2">Estado</th></tr></thead>
          <tbody>{board.sheets.map((sheet) => <tr key={sheet.id} className="bg-surface-container/60"><td className="rounded-l-xl p-3 font-bold">{sheet.employment.employee.displayName}</td>{sheet.lines.map((line) => <td key={line.id} className="p-3 text-right">{line.workedMinutes ? formatMinutes(line.workedMinutes) : "—"}</td>)}<td className="p-3 text-right font-black">{formatMinutes(sheet.effectiveMinutes)}</td><td className="p-3 text-center">{sheet.lines.reduce((sum, line) => sum + line.attendanceIssueCount, 0)}</td><td className="rounded-r-xl p-3 text-center">{humanLabel(timesheetStatusLabels, sheet.status)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-4">
        {board.sheets.map((sheet) => {
          const state = readiness(sheet);
          const editable = sheet.status === "OPEN" || sheet.status === "REVIEW";
          return <Card key={sheet.id} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-black">{sheet.employment.employee.displayName}</h3><p className="text-sm">{dateKey(sheet.periodStart)} → {dateKey(sheet.periodEnd)}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border px-3 py-1 text-xs font-bold">{humanLabel(timesheetReadinessLabels, state)}</span><span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold">{humanLabel(timesheetStatusLabels, sheet.status)}</span>{sheet.requiresAdjustment ? <span className="rounded-full bg-error/10 px-3 py-1 text-xs font-bold text-error">Hay cambios nuevos</span> : null}</div></div>
            <div className="grid grid-cols-3 gap-2 text-sm"><p><strong>Base</strong><br />{formatMinutes(sheet.status === "APPROVED" || sheet.status === "LOCKED" ? sheet.approvedBaseMinutes ?? sheet.baseWorkedMinutes : sheet.baseWorkedMinutes)}</p><p><strong>Ajustes</strong><br />{formatMinutes(sheet.status === "APPROVED" || sheet.status === "LOCKED" ? sheet.approvedAdjustmentMinutes ?? sheet.adjustmentMinutes : sheet.adjustmentMinutes)}</p><p><strong>Efectivo</strong><br />{formatMinutes(sheet.status === "APPROVED" || sheet.status === "LOCKED" ? sheet.approvedEffectiveMinutes ?? sheet.effectiveMinutes : sheet.effectiveMinutes)}</p></div>
            <div className="grid gap-2 md:hidden">{sheet.lines.map((line, index) => <div key={line.id} className="rounded-lg border p-3"><div className="flex justify-between"><strong>{days[index]} {dateKey(line.businessDate).slice(5)}</strong><strong>{line.workedMinutes ? formatMinutes(line.workedMinutes) : "—"}</strong></div><p className="text-xs text-on-surface-variant">{line.sessionCount} sesiones · {line.attendanceIssueCount} issues</p></div>)}</div>
            <details className="rounded-lg border p-3"><summary className="cursor-pointer font-bold">Detalle diario y edición auditable</summary><div className="mt-3 space-y-3">{sheet.lines.map((line, index) => <div key={line.id} className="rounded-lg bg-surface-container p-3 text-sm"><div className="flex justify-between"><strong>{days[index]} · {dateKey(line.businessDate)}</strong><strong>{formatMinutes(line.totalPayableMinutes)}</strong></div><p>Base {formatMinutes(line.workedMinutes)} · descanso {formatMinutes(line.breakMinutes)} · {line.sessionCount} sesiones · programado {formatMinutes(line.scheduledMinutes)}</p>{line.workSessionLinks.map((link) => { const session = link.workSession; return <div key={link.id} className="mt-3 space-y-3 rounded-lg border border-outline-variant bg-surface p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{session.branch.name}</strong><div className="flex flex-wrap gap-2"><span className="text-xs font-semibold">{session.status === "COMPLETE" ? "Completa" : session.status === "INCOMPLETE" ? "Incompleta" : "Abierta"}</span>{session.shift ? null : <span className="rounded-full bg-secondary/10 px-2 py-1 text-xs font-bold">Trabajo no programado</span>}</div></div><p className="text-xs">Entrada {localMoment(session.startedAt, session.branch.timezone)} · Salida {localMoment(session.endedAt, session.branch.timezone)} · Descanso {formatMinutes(session.breakMinutes ?? 0)} · Total {formatMinutes(session.workedMinutes)}</p>{session.clockEventLinks.length ? <div className="space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Eventos de reloj</p>{session.clockEventLinks.map((eventLink, eventIndex) => { const event = eventLink.clockEvent; const duplicate = session.clockEventLinks.slice(0, eventIndex).some((previous) => previous.clockEvent.type === event.type); return <div key={eventLink.id} className="space-y-2 rounded-lg border border-outline-variant p-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{humanLabel(clockEventLabels, event.type)} · {localMoment(event.deviceOccurredAt, session.branch.timezone)}</span>{duplicate ? <form action={workforceAdminClockCorrectionAction}><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="employmentId" value={sheet.employmentId} /><input type="hidden" name="type" value="VOID_EVENT" /><input type="hidden" name="targetClockEventId" value={event.id} /><input type="hidden" name="reason" value="Evento duplicado anulado desde horas trabajadas." /><button className="min-h-9 rounded-lg border border-error px-2 text-xs font-bold text-error">Anular duplicado</button></form> : null}</div><ClockCorrectionForm event={event} employmentId={sheet.employmentId} returnTo={back} /></div>; })}</div> : null}{session.attendanceExceptions.length ? <div className="flex flex-wrap gap-2">{session.attendanceExceptions.map((issue) => <span key={issue.id} className="rounded-full bg-error/10 px-2 py-1 text-xs font-bold text-error">{humanLabel(attendanceTypeLabels, issue.type)}</span>)}</div> : null}{!session.startedAt ? <MissingEventForm employmentId={sheet.employmentId} branchId={session.branchId} day={line.businessDate} proposedEventType="CLOCK_IN" returnTo={back} label="Agregar entrada" hour={9} /> : null}{!session.endedAt ? <MissingEventForm employmentId={sheet.employmentId} branchId={session.branchId} day={line.businessDate} proposedEventType="CLOCK_OUT" returnTo={back} label="Agregar salida" hour={18} /> : null}{session.clockEventLinks.at(-1)?.clockEvent.type === "BREAK_START" ? <MissingEventForm employmentId={sheet.employmentId} branchId={session.branchId} day={line.businessDate} proposedEventType="BREAK_END" returnTo={back} label="Agregar fin de descanso" hour={14} /> : null}{session.clockEventLinks[0]?.clockEvent.type === "BREAK_END" ? <MissingEventForm employmentId={sheet.employmentId} branchId={session.branchId} day={line.businessDate} proposedEventType="BREAK_START" returnTo={back} label="Agregar inicio de descanso" hour={13} /> : null}</div>; })}{!line.workSessionLinks.length && board.branches[0] ? <MissingEventForm employmentId={sheet.employmentId} branchId={board.branches[0].id} day={line.businessDate} proposedEventType="CLOCK_IN" returnTo={back} label="Agregar entrada" hour={9} /> : null}{line.adjustments.map((adjustment) => <p key={adjustment.id} className="text-xs font-semibold">{adjustment.type === "REMOVE_PAYABLE_TIME" ? "−" : "+"}{formatMinutes(adjustment.minutes)} · {adjustment.reason}</p>)}{editable ? <details className="mt-2 rounded-lg border border-primary/30 p-3"><summary className="cursor-pointer font-bold text-primary">Ajustes avanzados</summary><form action={workforceTimesheetAdjustmentAction} className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]"><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="lineId" value={line.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><select name="type" className="min-h-11 rounded-lg border p-2"><option value="ADD_PAYABLE_TIME">Sumar tiempo</option><option value="REMOVE_PAYABLE_TIME">Restar tiempo</option></select><input required name="minutes" type="number" min="1" max="1440" placeholder="Minutos" className="min-h-11 w-full rounded-lg border p-2" /><input required minLength={5} name="reason" placeholder="Razón" className="min-h-11 w-full rounded-lg border p-2" /><button className="min-h-11 rounded-lg border border-primary px-3 font-bold text-primary">Registrar ajuste</button></form></details> : null}</div>)}</div></details>
            {editable ? <form action={workforceTimesheetApprovalAction} className="space-y-2">{state === "NEEDS_REVIEW" ? <p className="text-sm font-semibold text-error">Hay advertencias abiertas. Al aprobar confirmas que revisaste el detalle y aceptas el total mostrado.</p> : null}<input type="hidden" name="returnTo" value={back} /><input type="hidden" name="timesheetId" value={sheet.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button disabled={state === "BLOCKED"} className="min-h-12 w-full rounded-xl bg-primary px-4 font-black text-on-primary disabled:cursor-not-allowed disabled:opacity-40">Aprobar {formatMinutes(sheet.effectiveMinutes)}</button></form> : null}
            {sheet.status === "APPROVED" && sheet.requiresAdjustment ? <form action={workforceTimesheetRequestReviewAction} className="space-y-2"><p className="text-sm font-semibold text-error">Trabajo añadido después de aprobación. Ingrese razón para reenviar a revisión.</p><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="timesheetId" value={sheet.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><textarea name="reason" minLength={5} required rows={3} className="w-full rounded-lg border p-2" placeholder="Ej. Trabajo no programado detectado post-aprobación." /><button className="min-h-12 w-full rounded-xl bg-secondary px-4 font-black text-on-secondary">Enviar a revisión</button></form> : null}
            {sheet.status === "APPROVED" && !sheet.requiresAdjustment ? <form action={workforceTimesheetLockAction}><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="timesheetId" value={sheet.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><button className="min-h-12 w-full rounded-xl border px-4 font-bold">Bloquear para Payroll</button></form> : null}
          </Card>;
        })}
        {!board.sheets.length ? <Card>No hay Timesheets para estos filtros.</Card> : null}
      </div>
    </section>
  );
}
