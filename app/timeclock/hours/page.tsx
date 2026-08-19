import Link from "next/link";
import { getMyTimeClockSummary } from "@/app/actions/timeclock";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { ChevronLeftIcon, ClockIcon, DollarIcon } from "@/components/ui/icons";

function formatHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export default async function MyHoursPage() {
  const summary = await getMyTimeClockSummary();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-md space-y-6">
        <Link href="/timeclock" className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface">
          <ChevronLeftIcon className="h-4 w-4" /> Volver al checador
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Mis horas y pagos</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Resumen de la semana actual.</p>
        </div>

        {"error" in summary ? (
          <p className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">{summary.error}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardLabel><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5" />Hoy</span></CardLabel>
              <CardValue>{formatHours(summary.todayHours)}</CardValue>
            </Card>
            <Card>
              <CardLabel><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5" />Esta semana</span></CardLabel>
              <CardValue>{formatHours(summary.weekHours)}</CardValue>
            </Card>
            <Card highlight className="col-span-2">
              <CardLabel><span className="inline-flex items-center gap-1.5"><DollarIcon className="h-3.5 w-3.5" />Pago estimado esta semana</span></CardLabel>
              <CardValue>{summary.weekPay === null ? "—" : formatCurrency(summary.weekPay)}</CardValue>
              {summary.hourlyRate === null ? (
                <p className="mt-2 text-xs text-on-surface-variant">Tu pago por hora todavía no está configurado.</p>
              ) : (
                <p className="mt-2 text-xs text-on-surface-variant">Tarifa registrada: {formatCurrency(summary.hourlyRate)} por hora. El total es estimado hasta que cierre la nómina.</p>
              )}
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
