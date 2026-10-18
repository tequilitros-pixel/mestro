import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { CalendarIcon, ChevronLeftIcon, ClockIcon, DollarIcon } from "@/components/ui/icons";
import type { ApprovedPayrollHistoryItem } from "@/app/actions/employeePayrollHistory";

export type EmployeePayrollSummary = {
  hourlyRate: number | null;
  hasOpenShift: boolean;
  todayHours: number;
  weekHours: number;
  totalHours: number;
  totalPay: number | null;
  closedShifts: number;
  todayPay: number | null;
  weekPay: number | null;
};

function formatHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function formatWeek(weekStart: string, weekEnd: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${weekStart}T12:00:00.000Z`))} – ${formatter.format(
    new Date(`${weekEnd}T12:00:00.000Z`),
  )}`;
}

function formatApprovalDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

export default function EmployeePayrollView({
  userName,
  summary,
  history,
}: {
  userName: string;
  summary: EmployeePayrollSummary | { error: string };
  history: ApprovedPayrollHistoryItem[] | { error: string };
}) {
  const approvedHistory = "error" in history ? [] : history;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/timeclock"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Volver al checador
        </Link>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Trabajador</p>
          <h1 className="mt-1 text-3xl font-bold">Mi nómina</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{userName} · horas y pago acumulado</p>
        </div>

        {"error" in summary ? (
          <p className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">{summary.error}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card highlight>
                <CardLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <DollarIcon className="h-3.5 w-3.5" /> Pago acumulado
                  </span>
                </CardLabel>
                <CardValue>{summary.totalPay === null ? "—" : formatCurrency(summary.totalPay)}</CardValue>
                <p className="mt-1 text-xs text-on-surface-variant">Estimado con tu tarifa actual</p>
              </Card>

              <Card>
                <CardLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5" /> Horas acumuladas
                  </span>
                </CardLabel>
                <CardValue>{formatHours(summary.totalHours)}</CardValue>
                <p className="mt-1 text-xs text-on-surface-variant">{summary.closedShifts} turnos cerrados</p>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardLabel>Hoy</CardLabel>
                <CardValue>{formatHours(summary.todayHours)}</CardValue>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {summary.todayPay === null ? "Sin tarifa" : formatCurrency(summary.todayPay)}
                </p>
              </Card>
              <Card>
                <CardLabel>Esta semana</CardLabel>
                <CardValue>{formatHours(summary.weekHours)}</CardValue>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {summary.weekPay === null ? "Sin tarifa" : formatCurrency(summary.weekPay)}
                </p>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/timeclock/calendar"
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold hover:border-primary/40"
              >
                <CalendarIcon className="h-4 w-4" /> Mi horario
              </Link>
              <Link
                href="/timeclock/hours"
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold hover:border-primary/40"
              >
                <ClockIcon className="h-4 w-4" /> Horas trabajadas
              </Link>
            </div>

            <p className="text-xs text-on-surface-variant">
              {summary.hasOpenShift
                ? "Tienes un turno abierto; el tiempo actual ya está incluido en el estimado."
                : "El acumulado se calcula con tus entradas y salidas registradas."}
              {summary.hourlyRate === null && " Falta configurar tu tarifa para calcular el pago."}
            </p>
          </>
        )}

        <Card>
          <CardLabel>Historial de nómina aprobada</CardLabel>
          <p className="mt-1 text-sm text-on-surface-variant">
            Semanas ya aprobadas por administración. Las horas y el pago son el registro confirmado de esa semana.
          </p>

          {"error" in history ? (
            <p className="mt-4 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">{history.error}</p>
          ) : approvedHistory.length === 0 ? (
            <p className="mt-4 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
              Aún no tienes semanas de nómina aprobadas.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-outline-variant rounded-xl border border-outline-variant">
              {approvedHistory.map((item) => {
                const approvedDate = formatApprovalDate(item.approvedAt);
                const paidDate = formatApprovalDate(item.paidAt);
                const statusLabel = item.status === "PAGADA" ? "Pagada" : "Aprobada";

                return (
                  <li key={item.weekStart} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-on-surface">{formatWeek(item.weekStart, item.weekEnd)}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {item.regularHours.toFixed(2)} h regulares
                          {item.overtimeHours > 0 && ` · ${item.overtimeHours.toFixed(2)} h extra`}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.status === "PAGADA"
                            ? "bg-primary/15 text-primary"
                            : "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-on-surface-variant">Horas aprobadas</p>
                        <p className="font-semibold text-on-surface">{formatHours(item.totalHours)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">Pago aprobado</p>
                        <p className="text-lg font-bold text-primary">{formatCurrency(item.totalPay)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {paidDate ? `Pagada el ${paidDate}` : approvedDate ? `Aprobada el ${approvedDate}` : "Aprobada"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
