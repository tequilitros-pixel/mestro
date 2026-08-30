import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { getAttendanceCenter } from "@/lib/workforce/attendance/queries";
import { workforceAttendanceDecisionAction } from "@/app/actions/workforceAttendance";

const types = [
  "LATE_ARRIVAL",
  "EARLY_DEPARTURE",
  "NO_SHOW",
  "UNSCHEDULED_WORK",
  "MISSING_CLOCK_IN",
  "MISSING_CLOCK_OUT",
  "INCOMPLETE_BREAK",
  "LONG_BREAK",
];
const date = (value: Date | null) =>
  value
    ? value.toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const dateInput = (value: Date) => value.toISOString().slice(0, 10);
const startOfDay = (value: string | undefined, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return new Date(`${value}T00:00:00.000Z`);
};
const recommendation: Record<string, string> = {
  LATE_ARRIVAL: "Revisar contexto o solicitar corrección de reloj.",
  EARLY_DEPARTURE: "Confirmar salida autorizada.",
  NO_SHOW: "Contactar al empleado y validar el turno.",
  UNSCHEDULED_WORK: "Confirmar que el trabajo fue autorizado.",
  MISSING_CLOCK_IN: "Solicitar corrección del evento faltante.",
  MISSING_CLOCK_OUT: "Solicitar corrección del evento faltante.",
  INCOMPLETE_BREAK: "Revisar la secuencia de descansos.",
  LONG_BREAK: "Confirmar si el descanso fue autorizado.",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, query] = await Promise.all([requireAdmin(), searchParams]);
  const today = new Date();
  const defaultStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7),
  );
  const defaultEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
  );
  const start = startOfDay(query.start, defaultStart);
  const end = startOfDay(query.end, defaultEnd);
  const selectedStatus = ["OPEN", "RESOLVED", "DISMISSED"].includes(
    query.status ?? "OPEN",
  )
    ? (query.status ?? "OPEN")
    : "OPEN";
  const center = await getAttendanceCenter(
    { id: user.id, role: user.role, accessibleBranchIds: null },
    {
      start,
      end,
      branchId: query.branch || undefined,
      employee: query.employee || undefined,
      type: types.includes(query.type ?? "") ? query.type : undefined,
      severity: ["INFO", "WARNING", "CRITICAL"].includes(
        query.severity ?? "",
      )
        ? query.severity
        : undefined,
      status: selectedStatus,
    },
  );
  return (
    <section className="space-y-4">
      {query.saved ? (
        <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">
          {query.saved}
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="rounded-xl bg-error/10 p-3 text-error">
          {query.error}
        </p>
      ) : null}
      <div>
        <h2 className="text-2xl font-black">Centro de asistencia</h2>
        <p className="text-sm text-on-surface-variant">
          Bandeja de diferencias significativas entre horario y trabajo real.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><p className="text-sm">Necesitan atención</p><p className="text-3xl font-black">{center.summary.openCount}</p></Card>
        <Card><p className="text-sm">Críticas</p><p className="text-3xl font-black text-error">{center.summary.criticalCount}</p></Card>
        <Card className="col-span-2 sm:col-span-1"><p className="text-sm">Resultados visibles</p><p className="text-3xl font-black">{center.items.length}</p></Card>
      </div>
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="text-sm">Desde<input name="start" type="date" defaultValue={dateInput(start)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Hasta<input name="end" type="date" defaultValue={dateInput(end)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Sucursal<select name="branch" defaultValue={query.branch ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todas</option>{center.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-sm">Empleado<input name="employee" defaultValue={query.employee ?? ""} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Tipo<select name="type" defaultValue={query.type ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todos</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="text-sm">Severidad<select name="severity" defaultValue={query.severity ?? ""} className="mt-1 w-full rounded-lg border p-2"><option value="">Todas</option><option>INFO</option><option>WARNING</option><option>CRITICAL</option></select></label>
          <label className="text-sm">Estado<select name="status" defaultValue={selectedStatus} className="mt-1 w-full rounded-lg border p-2"><option value="">Todos</option><option>OPEN</option><option>RESOLVED</option><option>DISMISSED</option></select></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary sm:col-span-3 lg:col-span-6">Aplicar filtros y recalcular</button>
        </form>
      </Card>
      {center.items.length ? center.items.map((item) => (
        <Card key={item.id} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div><h3 className="text-lg font-black">{item.employment.employee.displayName ?? "Empleado"}</h3><p className="text-sm">{item.branch.name} · {dateInput(item.businessDate)}</p></div>
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold">{item.type}</span><span className="rounded-full border px-3 py-1 text-xs font-bold">{item.severity}</span><span className="rounded-full border px-3 py-1 text-xs">{item.status}</span></div>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <p><strong>Programado</strong><br />{date(item.scheduledStart)} – {date(item.scheduledEnd)}</p>
            <p><strong>Real</strong><br />{date(item.actualStart)} – {date(item.actualEnd)}</p>
            <p><strong>Diferencia</strong><br />{item.differenceMinutes === null ? "No aplica" : `${item.differenceMinutes} min`}</p>
            <p><strong>Acción sugerida</strong><br />{recommendation[item.type] ?? "Revisar detalle."}</p>
          </div>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-bold">Ver detalle y resolver</summary>
            <div className="mt-3 space-y-3 text-sm">
              <p><strong>Plan:</strong> {date(item.scheduledStart)} – {date(item.scheduledEnd)}</p>
              <p><strong>WorkSession:</strong> {date(item.actualStart)} – {date(item.actualEnd)} · {item.workSession?.workedMinutes ?? 0} min trabajados · {item.workSession?.breakMinutes ?? 0} min descanso.</p>
              <p><strong>Clock facts:</strong> {item.workSession?.clockEventLinks.map((link) => `${link.clockEvent.type} ${date(link.clockEvent.deviceOccurredAt)}`).join(" · ") || "Sin ClockEvent observado vinculado."}</p>
              {item.status === "OPEN" ? <>
                <Link href="/administration/workforce-v1/clock-corrections" className="inline-block font-bold text-primary underline">Ir a correcciones de reloj</Link>
                <form action={workforceAttendanceDecisionAction} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="exceptionId" value={item.id} />
                  <input required minLength={5} name="resolution" placeholder="Nota de resolución" className="min-h-11 rounded-lg border p-2" />
                  <button name="decision" value="RESOLVED" className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary">Resolver</button>
                  <button name="decision" value="DISMISSED" className="min-h-11 rounded-lg border px-4 font-bold">Descartar</button>
                </form>
              </> : <p><strong>Resolución:</strong> {item.resolution ?? "Sin nota"} · {date(item.resolvedAt)}</p>}
            </div>
          </details>
        </Card>
      )) : <Card>No hay excepciones para los filtros seleccionados.</Card>}
    </section>
  );
}
