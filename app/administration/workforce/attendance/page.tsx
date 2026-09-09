import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { formatMinutes, localBusinessDate } from "@/lib/workforce/timesheet/rules";
import {
  getAttendanceCenter,
  type AttendanceIncidenceFilter,
  type AttendanceOccurrence,
  type AttendanceStatusFilter,
} from "@/lib/workforce/attendance/queries";
import {
  attendanceStateLabels,
  attendanceStatusLabels,
  humanAttendanceIssueLabel,
} from "@/lib/workforce/attendance/presentation";
import { workforceAttendanceDecisionAction } from "@/app/actions/workforceAttendance";

const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const centralDate = (value: Date) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(value);
const moment = (value: Date | null, timezone: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        timeZone: timezone ?? "America/Mexico_City",
        dateStyle: "short",
        timeStyle: "short",
      }).format(value)
    : "—";
const dayStart = (value: string | undefined, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};
const statusLabels: Record<AttendanceStatusFilter, string> = {
  ALL: "Todos",
  OPEN: "Pendientes",
  RESOLVED: "Resueltos",
  DISMISSED: "Revisados",
};
const incidenceLabels: Record<AttendanceIncidenceFilter, string> = {
  ALL: "Todos",
  WITH: "Con incidencia",
  WITHOUT: "Sin incidencia",
};

function issueText(item: AttendanceOccurrence) {
  if (item.issueTypes.length)
    return item.issueTypes.map(humanAttendanceIssueLabel).join(" · ");
  return item.state === "WAITING" ? "Todavía no registra entrada" : "Sin incidencia";
}

function totalText(item: AttendanceOccurrence) {
  return item.workedMinutes === null ? "—" : formatMinutes(item.workedMinutes);
}

function realText(item: AttendanceOccurrence) {
  if (item.actualStart && !item.actualEnd)
    return `Entrada ${moment(item.actualStart, item.branchTimezone)} · en curso`;
  if (item.actualStart)
    return `${moment(item.actualStart, item.branchTimezone)} – ${moment(item.actualEnd, item.branchTimezone)}`;
  return "Sin entrada registrada";
}

function Actions({ item }: { item: AttendanceOccurrence }) {
  if (item.status === "OPEN" && item.primaryExceptionId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.action === "CORRECT" ? (
          <Link
            href="/administration/workforce/clock-corrections"
            className="rounded-lg border border-primary px-3 py-2 text-sm font-bold text-primary"
          >
            Corregir registro
          </Link>
        ) : null}
        <form action={workforceAttendanceDecisionAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="exceptionId" value={item.primaryExceptionId} />
          <input
            required
            minLength={5}
            name="resolution"
            placeholder="Nota breve"
            aria-label={`Nota de resolución para ${item.employeeName}`}
            className="min-h-10 min-w-0 rounded-lg border p-2 text-sm"
          />
          <button
            name="decision"
            value="RESOLVED"
            className="min-h-10 rounded-lg bg-primary px-3 text-sm font-bold text-on-primary"
          >
            Resolver
          </button>
          <button
            name="decision"
            value="DISMISSED"
            className="min-h-10 rounded-lg border px-3 text-sm font-bold"
          >
            Marcar revisado
          </button>
        </form>
      </div>
    );
  }
  if (item.workSessionId)
    return (
      <Link
        href={`/administration/workforce/timesheets?date=${dateKey(item.businessDate)}`}
        className="font-bold text-primary underline"
      >
        Ver horas
      </Link>
    );
  return null;
}

function OccurrenceCard({ item }: { item: AttendanceOccurrence }) {
  return (
    <Card className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black">{item.employeeName}</h3>
          <p className="break-words text-sm text-on-surface-variant">{item.branchName}</p>
        </div>
        <span className="shrink-0 rounded-full border px-2 py-1 text-xs font-bold">
          {attendanceStatusLabels[item.status]}
        </span>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p><strong>Estado</strong><br />{attendanceStateLabels[item.state]}</p>
        <p><strong>Incidencia</strong><br />{issueText(item)}</p>
        <p><strong>Programado</strong><br />{moment(item.scheduledStart, item.branchTimezone)} – {moment(item.scheduledEnd, item.branchTimezone)}</p>
        <p><strong>Real</strong><br />{realText(item)}</p>
        <p><strong>Total</strong><br />{totalText(item)}</p>
        {item.differenceMinutes !== null ? <p><strong>Diferencia</strong><br />{item.differenceMinutes} min</p> : null}
      </div>
      {item.status !== "NONE" && item.resolution ? (
        <p className="text-sm text-on-surface-variant">
          {attendanceStatusLabels[item.status]}: {item.resolution}
          {item.resolvedByName ? ` · ${item.resolvedByName}` : ""}
        </p>
      ) : null}
      <Actions item={item} />
    </Card>
  );
}

function OccurrenceTable({ items }: { items: AttendanceOccurrence[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-outline-variant md:block">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-surface-container text-xs uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="p-3">Empleado</th>
            <th className="p-3">Sucursal</th>
            <th className="p-3">Programado</th>
            <th className="p-3">Real</th>
            <th className="p-3">Incidencia</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-outline-variant align-top">
              <td className="p-3 font-bold">{item.employeeName}</td>
              <td className="p-3">{item.branchName}</td>
              <td className="p-3">{moment(item.scheduledStart, item.branchTimezone)}<br />{moment(item.scheduledEnd, item.branchTimezone)}</td>
              <td className="p-3">{realText(item)}<br /><span className="text-on-surface-variant">{totalText(item)}</span></td>
              <td className="p-3">{issueText(item)}</td>
              <td className="p-3">{attendanceStatusLabels[item.status]}<br /><span className="text-on-surface-variant">{attendanceStateLabels[item.state]}</span></td>
              <td className="max-w-[280px] p-3"><Actions item={item} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OccurrenceList({ items }: { items: AttendanceOccurrence[] }) {
  return (
    <>
      <div className="grid gap-3 md:hidden">{items.map((item) => <OccurrenceCard key={item.id} item={item} />)}</div>
      <OccurrenceTable items={items} />
    </>
  );
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, query] = await Promise.all([requireAdmin(), searchParams]);
  const now = new Date();
  const fallbackToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = localBusinessDate(now, "America/Mexico_City");
  const selectedDate = dayStart(query.date ?? query.start, today.getTime() ? today : fallbackToday);
  const status = (query.status ?? "ALL") as AttendanceStatusFilter;
  const incidence = (query.incidence ?? "ALL") as AttendanceIncidenceFilter;
  const activeStatus = ["ALL", "OPEN", "RESOLVED", "DISMISSED"].includes(status) ? status : "ALL";
  const activeIncidence = ["ALL", "WITH", "WITHOUT"].includes(incidence) ? incidence : "ALL";
  const center = await getAttendanceCenter(
    { id: user.id, role: user.role, accessibleBranchIds: null },
    {
      start: selectedDate,
      end: selectedDate,
      branchId: query.branch || undefined,
      status: activeStatus,
      incidence: activeIncidence,
      now,
    },
  );
  const selectedKey = dateKey(selectedDate);
  const todayKey = dateKey(today);
  const attention = center.attention;
  const reviewed = center.reviewed;
  const normal = center.normal;
  return (
    <section className="space-y-5">
      {query.saved ? <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">{query.saved}</p> : null}
      {query.error ? <p role="alert" className="rounded-xl bg-error/10 p-3 text-error">{query.error}</p> : null}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Workforce · operación</p>
          <h1 className="text-3xl font-black">Asistencia</h1>
          <p className="text-sm text-on-surface-variant">{selectedKey === todayKey ? "Hoy" : "Fecha seleccionada"} · {centralDate(selectedDate)}</p>
        </div>
        <p className="max-w-md text-sm text-on-surface-variant">Lo normal queda en segundo plano. Las personas que necesitan atención aparecen primero.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-sm text-on-surface-variant">Trabajando ahora</p><p className="text-3xl font-black">{center.summary.workingNow}</p></Card>
        <Card><p className="text-sm text-on-surface-variant">Completaron turno</p><p className="text-3xl font-black">{center.summary.completed}</p></Card>
        <Card><p className="text-sm text-on-surface-variant">Incidencias</p><p className="text-3xl font-black">{center.summary.incidents}</p></Card>
        <Card><p className="text-sm text-on-surface-variant">No llegaron</p><p className="text-3xl font-black">{center.summary.noShows}</p></Card>
      </div>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_1fr_auto] lg:items-end">
          <label className="text-sm font-semibold">Fecha<input name="date" type="date" defaultValue={selectedKey} className="mt-1 min-h-11 w-full rounded-lg border p-2" /></label>
          <label className="text-sm font-semibold">Sucursal<select name="branch" defaultValue={query.branch ?? ""} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option value="">Todas las sucursales</option>{center.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Estado<select name="status" defaultValue={activeStatus} className="mt-1 min-h-11 w-full rounded-lg border p-2">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-semibold">Mostrar<select name="incidence" defaultValue={activeIncidence} className="mt-1 min-h-11 w-full rounded-lg border p-2">{Object.entries(incidenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary">Aplicar</button>
        </form>
        <p className="mt-3 text-xs text-on-surface-variant">Todas las sucursales por defecto · pendientes primero · descansos históricos no se muestran como incidencias operativas.</p>
      </Card>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div>
          <h2 id="attention-heading" className="text-2xl font-black">Requieren atención <span className="text-primary">{attention.length}</span></h2>
          <p className="text-sm text-on-surface-variant">Aquí se concentran tardanzas, faltas de registro, trabajo no programado y salidas anticipadas.</p>
        </div>
        {attention.length ? <OccurrenceList items={attention} /> : <Card><p className="text-sm text-on-surface-variant">No hay incidencias pendientes para esta fecha y filtros.</p></Card>}
      </section>

      {reviewed.length ? <section aria-labelledby="reviewed-heading" className="space-y-3"><div><h2 id="reviewed-heading" className="text-xl font-black">Revisadas</h2><p className="text-sm text-on-surface-variant">La incidencia permanece visible como historial; resolver no borra el hecho.</p></div><OccurrenceList items={reviewed} /></section> : null}

      <section aria-labelledby="normal-heading" className="space-y-3">
        <div><h2 id="normal-heading" className="text-xl font-black">Actividad normal <span className="text-on-surface-variant">{normal.length}</span></h2><p className="text-sm text-on-surface-variant">Turnos en curso, completados y entradas todavía dentro de la tolerancia.</p></div>
        {normal.length ? <OccurrenceList items={normal} /> : <Card><p className="text-sm text-on-surface-variant">No hay actividad normal para esta fecha y filtros.</p></Card>}
      </section>
    </section>
  );
}
