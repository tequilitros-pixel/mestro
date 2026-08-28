import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { getTimesheetBoard } from "@/lib/workforce/timesheet/service";
import { dateKey, formatMinutes, mondayOf, timesheetReadiness } from "@/lib/workforce/timesheet/rules";
import {
  workforceTimesheetAdjustmentAction,
  workforceTimesheetApprovalAction,
  workforceTimesheetLockAction,
} from "@/app/actions/workforceTimesheet";

const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const parseWeek = (value?: string) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? mondayOf(new Date(`${value}T00:00:00.000Z`))
    : mondayOf(new Date());
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

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [user, query] = await Promise.all([requireAdmin(), searchParams]);
  const week = parseWeek(query.week);
  const status = ["OPEN", "REVIEW", "APPROVED", "LOCKED"].includes(query.status ?? "") ? query.status : undefined;
  const board = await getTimesheetBoard(
    { id: user.id, role: user.role, accessibleBranchIds: null },
    week,
    query.search || undefined,
    status,
    query.branch || undefined,
  );
  const back = `/administration/workforce-v1/timesheets?week=${dateKey(board.start)}${query.search ? `&search=${encodeURIComponent(query.search)}` : ""}${query.branch ? `&branch=${encodeURIComponent(query.branch)}` : ""}${status ? `&status=${status}` : ""}`;
  return (
    <section className="space-y-4">
      {query.saved ? <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">{query.saved}</p> : null}
      {query.error ? <p role="alert" className="rounded-xl bg-error/10 p-3 text-error">{query.error}</p> : null}
      <div><h2 className="text-2xl font-black">Timesheets semanales</h2><p className="text-sm text-on-surface-variant">Aprobación de tiempo trabajado · lunes a domingo · sin cálculo monetario.</p></div>
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">Semana<input name="week" type="date" defaultValue={dateKey(board.start)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Sucursal<select name="branch" defaultValue={query.branch ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todas</option>{board.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-sm">Empleado<input name="search" defaultValue={query.search ?? ""} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Estado<select name="status" defaultValue={status ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todos</option><option>OPEN</option><option>REVIEW</option><option>APPROVED</option><option>LOCKED</option></select></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary sm:col-span-4">Abrir periodo</button>
        </form>
      </Card>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
          <thead><tr><th className="p-2 text-left">Empleado</th>{days.map((day) => <th key={day} className="p-2 text-right">{day}</th>)}<th className="p-2 text-right">Total</th><th className="p-2">Issues</th><th className="p-2">Estado</th></tr></thead>
          <tbody>{board.sheets.map((sheet) => <tr key={sheet.id} className="bg-surface-container/60"><td className="rounded-l-xl p-3 font-bold">{sheet.employment.employee.displayName}</td>{sheet.lines.map((line) => <td key={line.id} className="p-3 text-right">{line.workedMinutes ? formatMinutes(line.workedMinutes) : "—"}</td>)}<td className="p-3 text-right font-black">{formatMinutes(sheet.effectiveMinutes)}</td><td className="p-3 text-center">{sheet.lines.reduce((sum, line) => sum + line.attendanceIssueCount, 0)}</td><td className="rounded-r-xl p-3 text-center">{sheet.status}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-4">
        {board.sheets.map((sheet) => {
          const state = readiness(sheet);
          const editable = sheet.status === "OPEN" || sheet.status === "REVIEW";
          return <Card key={sheet.id} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-black">{sheet.employment.employee.displayName}</h3><p className="text-sm">{dateKey(sheet.periodStart)} → {dateKey(sheet.periodEnd)}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border px-3 py-1 text-xs font-bold">{state}</span><span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold">{sheet.status}</span>{sheet.requiresAdjustment ? <span className="rounded-full bg-error/10 px-3 py-1 text-xs font-bold text-error">RETROACTIVE_CHANGE_REQUIRED</span> : null}</div></div>
            <div className="grid grid-cols-3 gap-2 text-sm"><p><strong>Base</strong><br />{formatMinutes(sheet.status === "APPROVED" || sheet.status === "LOCKED" ? sheet.approvedBaseMinutes ?? sheet.baseWorkedMinutes : sheet.baseWorkedMinutes)}</p><p><strong>Ajustes</strong><br />{formatMinutes(sheet.status === "APPROVED" || sheet.status === "LOCKED" ? sheet.approvedAdjustmentMinutes ?? sheet.adjustmentMinutes : sheet.adjustmentMinutes)}</p><p><strong>Efectivo</strong><br />{formatMinutes(sheet.status === "APPROVED" || sheet.status === "LOCKED" ? sheet.approvedEffectiveMinutes ?? sheet.effectiveMinutes : sheet.effectiveMinutes)}</p></div>
            <div className="grid gap-2 md:hidden">{sheet.lines.map((line, index) => <div key={line.id} className="rounded-lg border p-3"><div className="flex justify-between"><strong>{days[index]} {dateKey(line.businessDate).slice(5)}</strong><strong>{line.workedMinutes ? formatMinutes(line.workedMinutes) : "—"}</strong></div><p className="text-xs text-on-surface-variant">{line.sessionCount} sesiones · {line.attendanceIssueCount} issues</p></div>)}</div>
            <details className="rounded-lg border p-3"><summary className="cursor-pointer font-bold">Detalle diario y ajustes</summary><div className="mt-3 space-y-3">{sheet.lines.map((line, index) => <div key={line.id} className="rounded-lg bg-surface-container p-3 text-sm"><div className="flex justify-between"><strong>{days[index]} · {dateKey(line.businessDate)}</strong><strong>{formatMinutes(line.totalPayableMinutes)}</strong></div><p>Base {formatMinutes(line.workedMinutes)} · descanso {formatMinutes(line.breakMinutes)} · {line.sessionCount} sesiones · programado {formatMinutes(line.scheduledMinutes)}</p>{line.workSessionLinks.map((link) => <p key={link.id} className="text-xs">{link.workSession.branch.name}: {link.workSession.startedAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) ?? "sin entrada"}–{link.workSession.endedAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) ?? "sin salida"} · {formatMinutes(link.workSession.workedMinutes)}{link.workSession.shift ? " · Shift vinculado" : " · no programado"}</p>)}{line.adjustments.map((adjustment) => <p key={adjustment.id} className="text-xs font-semibold">{adjustment.type === "REMOVE_PAYABLE_TIME" ? "−" : "+"}{formatMinutes(adjustment.minutes)} · {adjustment.reason}</p>)}{editable ? <form action={workforceTimesheetAdjustmentAction} className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]"><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="lineId" value={line.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><select name="type" className="min-h-11 rounded-lg border p-2"><option value="ADD_PAYABLE_TIME">Sumar</option><option value="REMOVE_PAYABLE_TIME">Restar</option></select><input required name="minutes" type="number" min="1" max="1440" placeholder="Min" className="min-h-11 w-full rounded-lg border p-2" /><input required minLength={5} name="reason" placeholder="Razón" className="min-h-11 rounded-lg border p-2" /><button className="min-h-11 rounded-lg border border-primary px-3 font-bold text-primary">Ajustar</button></form> : null}</div>)}</div></details>
            {editable ? <form action={workforceTimesheetApprovalAction} className="space-y-2">{state === "NEEDS_REVIEW" ? <p className="text-sm font-semibold text-error">Hay advertencias abiertas. Al aprobar confirmas que revisaste el detalle y aceptas el total mostrado.</p> : null}<input type="hidden" name="returnTo" value={back} /><input type="hidden" name="timesheetId" value={sheet.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button disabled={state === "BLOCKED"} className="min-h-12 w-full rounded-xl bg-primary px-4 font-black text-on-primary disabled:cursor-not-allowed disabled:opacity-40">Aprobar {formatMinutes(sheet.effectiveMinutes)}</button></form> : null}
            {sheet.status === "APPROVED" ? <form action={workforceTimesheetLockAction}><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="timesheetId" value={sheet.id} /><input type="hidden" name="expectedVersion" value={sheet.version} /><button className="min-h-12 w-full rounded-xl border px-4 font-bold">Bloquear para Payroll</button></form> : null}
          </Card>;
        })}
        {!board.sheets.length ? <Card>No hay Timesheets para estos filtros.</Card> : null}
      </div>
    </section>
  );
}
