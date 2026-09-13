import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getOwnTimesheet } from "@/lib/workforce/timesheet/service";
import { dateKey, formatMinutes, mondayOf } from "@/lib/workforce/timesheet/rules";
import { previewOvertime } from "@/lib/workforce/overtime/service";

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function EmployeeTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) return null;

  const week = query.week && /^\d{4}-\d{2}-\d{2}$/.test(query.week)
    ? mondayOf(new Date(`${query.week}T00:00:00.000Z`))
    : mondayOf(new Date());
  let sheet: Awaited<ReturnType<typeof getOwnTimesheet>> | null = null;
  let loadError: unknown;

  try {
    sheet = await getOwnTimesheet({ id: user.id }, week);
  } catch (error) {
    loadError = error;
  }

  if (!sheet) {
    return (
      <Card>
        <h2 className="font-bold">Timesheet no disponible</h2>
        <p>{loadError instanceof Error ? loadError.message : "No se pudo resolver el periodo."}</p>
      </Card>
    );
  }

  const displayedTotal = sheet.status === "APPROVED" || sheet.status === "LOCKED"
    ? sheet.approvedEffectiveMinutes ?? sheet.effectiveMinutes
    : sheet.effectiveMinutes;
  let overtime: Awaited<ReturnType<typeof previewOvertime>> | null = null;
  if (sheet.status === "APPROVED" || sheet.status === "LOCKED") {
    try {
      overtime = await previewOvertime(sheet.id);
    } catch {
      overtime = null;
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-2xl font-black">Mi timesheet</h2>
        <p className="text-sm">{dateKey(sheet.periodStart)} → {dateKey(sheet.periodEnd)} · {sheet.status}</p>
      </div>
      <Card>
        <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            Semana
            <input name="week" type="date" defaultValue={dateKey(sheet.periodStart)} className="mt-1 w-full rounded-lg border p-3" />
          </label>
          <button className="min-h-12 rounded-lg border px-4 font-bold">Ver semana</button>
        </form>
      </Card>
      <Card className="space-y-2">
        <p className="text-sm">Total semanal</p>
        <p className="text-4xl font-black">{formatMinutes(displayedTotal)}</p>
        {sheet.requiresAdjustment ? <p className="font-bold text-error">Cambio histórico pendiente de ajuste administrativo.</p> : null}
      </Card>
      {overtime ? <Card className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-bold">Clasificación de overtime</h3><span className="rounded-full border px-2 py-1 text-xs font-bold">{overtime.mode}</span></div><div className="grid grid-cols-3 gap-2"><p><span className="text-xs">Ordinario</span><br /><strong>{formatMinutes(overtime.result.ordinaryMinutes)}</strong></p><p><span className="text-xs">Doble</span><br /><strong>{formatMinutes(overtime.result.doubleMinutes)}</strong></p><p><span className="text-xs">Triple</span><br /><strong>{formatMinutes(overtime.result.tripleMinutes)}</strong></p></div><p className="text-xs text-on-surface-variant">Clasificación de tiempo; no representa importe de pago.</p></Card> : null}
      <div className="space-y-2">
        {sheet.lines.map((line, index) => (
          <Card key={line.id}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">{days[index]}</h3>
                <p className="text-xs text-on-surface-variant">{dateKey(line.businessDate)} · {line.sessionCount} sesiones</p>
              </div>
              <p className="text-xl font-black">{line.workedMinutes ? formatMinutes(line.workedMinutes) : "—"}</p>
            </div>
            {line.needsReview ? <p className="mt-2 text-sm font-semibold text-error">Requiere revisión</p> : null}
          </Card>
        ))}
      </div>
      <Link href="/workforce/clock" className="block min-h-12 rounded-xl border border-primary p-3 text-center font-bold text-primary">
        Reportar un problema de reloj
      </Link>
    </section>
  );
}
