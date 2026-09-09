import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEmployeePayrollView } from "@/lib/workforce/payroll/service";
import { formatMinutes } from "@/lib/workforce/timesheet/rules";

const money = (value: { toString(): string } | null | undefined, currency: string) =>
  value === null || value === undefined
    ? "Pendiente"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value.toString()));
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const statusLabel: Record<string, string> = {
  APPROVED: "Aprobado",
  PAID: "Pagado",
  READY: "En preparación",
  APPROVED_SOURCE: "Listo para preparar",
  PROVISIONAL: "Acumulado provisional",
};
const blockerLabel: Record<string, string> = {
  TIMESHEET_NOT_APPROVED: "Horas pendientes de aprobación.",
  TIMESHEET_REQUIRES_ADJUSTMENT: "Requiere revisión administrativa.",
  OVERTIME_MISSING: "Tiempo extra pendiente de calcular.",
  OVERTIME_NOT_FINAL: "Tiempo extra pendiente de finalizar.",
  PAY_RATE_MISSING: "Falta la tarifa por hora.",
  PAY_RATE_OVERLAP: "Hay tarifas por hora superpuestas.",
  PAY_RATE_UNSUPPORTED: "La tarifa no es compatible con pago por hora.",
  PAY_RATE_CURRENCY_MISSING: "Falta la moneda de la tarifa.",
  PAY_RATE_CURRENCY_MISMATCH: "Las tarifas tienen monedas distintas.",
};

export default async function EmployeePayrollPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const { statements, accruals } = await getEmployeePayrollView(user.id, new Date());
  return <section className="mx-auto max-w-3xl space-y-5">
    <div><h1 className="text-2xl font-black">Mi pago acumulado</h1><p className="text-sm text-on-surface-variant">Consulta sólo tus horas y pagos operativos. No es CFDI ni recibo fiscal.</p></div>
    {accruals.length ? <div className="space-y-3"><h2 className="text-lg font-black">Semana actual</h2>{accruals.map((accrual) => <Card key={accrual.id} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{dateKey(accrual.periodStart)} → {dateKey(accrual.periodEnd)}</strong><p className="text-sm text-on-surface-variant">{statusLabel[accrual.payrollLineStatus ?? accrual.source] ?? "Pendiente de validar"}</p></div><p className="text-right"><span className="block text-xs text-on-surface-variant">Acumulado</span><strong className="text-3xl">{money(accrual.amount, accrual.currency ?? "MXN")}</strong></p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><p><span className="text-xs text-on-surface-variant">Horas</span><br /><strong>{formatMinutes(accrual.effectiveMinutes)}</strong></p><p><span className="text-xs text-on-surface-variant">Ordinarias</span><br /><strong>{formatMinutes(accrual.ordinaryMinutes)}</strong></p><p><span className="text-xs text-on-surface-variant">Dobles</span><br /><strong>{formatMinutes(accrual.doubleMinutes)}</strong></p><p><span className="text-xs text-on-surface-variant">Triples</span><br /><strong>{formatMinutes(accrual.tripleMinutes)}</strong></p></div>
      {accrual.source === "PROVISIONAL" ? <p className="text-sm text-on-surface-variant">Es una estimación con las horas registradas. El overtime y el importe final se confirman al aprobar el Timesheet.</p> : null}
      {accrual.blockers.length ? <div className="space-y-1 text-sm text-error">{accrual.blockers.map((blocker) => <p key={blocker}>{blockerLabel[blocker] ?? "Revisión administrativa pendiente."}</p>)}</div> : null}
      <a href={`/workforce/timesheet?week=${dateKey(accrual.periodStart)}`} className="block min-h-12 rounded-xl border border-primary p-3 text-center font-bold text-primary">Ver mis horas</a>
    </Card>)}</div> : null}
    {statements.length ? <div className="space-y-3"><h2 className="text-lg font-black">Pagos aprobados</h2>{statements.map((line)=><Card key={line.id} className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><strong>{dateKey(line.payrollPeriod.weekStart)} → {dateKey(line.payrollPeriod.weekEnd)}</strong><span>{statusLabel[line.status] ?? line.status}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><p>Ordinarias<br/><strong>{formatMinutes(line.regularMinutes)}<br/>{money(line.ordinaryPay,line.currencySnapshot)}</strong></p><p>Dobles<br/><strong>{formatMinutes(line.overtimeTier1Minutes)}<br/>{money(line.doublePay,line.currencySnapshot)}</strong></p><p>Triples<br/><strong>{formatMinutes(line.overtimeTier2Minutes)}<br/>{money(line.triplePay,line.currencySnapshot)}</strong></p><p>Total<br/><strong>{money(line.operationalPayable,line.currencySnapshot)}</strong></p></div><a href={`/workforce/timesheet?week=${dateKey(line.payrollPeriod.weekStart)}`} className="inline-block font-bold text-primary underline">Ver mis horas</a><details><summary className="cursor-pointer font-bold">Explicación</summary><div className="mt-2 space-y-1 text-sm">{line.rateSegments.map((segment)=><p key={segment.id}>{dateKey(segment.businessDate)} · {money(segment.hourlyRate,segment.currency)}/h · ordinarias {formatMinutes(segment.ordinaryMinutes)}, dobles {formatMinutes(segment.doubleMinutes)}, triples {formatMinutes(segment.tripleMinutes)}</p>)}{line.adjustments.map((item)=><p key={item.id}>{item.direction === "EARNING" ? "+" : "-"}{money(item.amount,line.currencySnapshot)} · {item.categoryName} · {item.reason}</p>)}</div></details></Card>)}</div> : null}
    {!accruals.length && !statements.length ? <Card>No hay horas ni pagos registrados para mostrar todavía.</Card> : null}
  </section>;
}
