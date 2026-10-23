import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { formatPaymentMoney } from "@/lib/accounting";
import type { BranchFinancialMetrics } from "@/lib/accounting/financialEngine";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DollarIcon,
  InfoIcon,
  PackageIcon,
  ReceiptIcon,
  UsersIcon,
} from "@/components/ui/icons";

interface BranchFinancialDashboardProps {
  metrics: BranchFinancialMetrics;
  periodLabel?: string;
  from: string;
  to: string;
}

const money = formatPaymentMoney;

export function BranchFinancialDashboard({
  metrics,
  periodLabel = "Mes",
  from,
  to,
}: BranchFinancialDashboardProps) {
  const grossProfit = metrics.sales - metrics.cogs;
  const grossMarginPercent =
    metrics.sales > 0
      ? Math.round((grossProfit / metrics.sales) * 1000) / 10
      : 0;

  const totalOpex = metrics.laborCost + metrics.rentCost + metrics.otherExpenses;
  const opexPercent =
    metrics.sales > 0
      ? Math.round((totalOpex / metrics.sales) * 1000) / 10
      : 0;

  const criticalAlerts = metrics.costAlerts.filter((a) => a.severity === "CRITICAL");
  const warningAlerts = metrics.costAlerts.filter((a) => a.severity === "WARNING");
  const infoAlerts = metrics.costAlerts.filter((a) => a.severity === "INFO");

  return (
    <section aria-label={`P&L y Desempeño Operativo · ${metrics.branchName}`} className="space-y-6">
      {/* Encabezado de Sucursal */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ReceiptIcon className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Estado de Resultados Operativo (P&L)
            </p>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">
            {metrics.branchName}
          </h2>
          <p className="text-sm text-on-surface-variant">
            Periodo del {from} al {to} ({periodLabel.toLowerCase()}). Ventas, margen bruto, nómina, rentas y utilidad neta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {metrics.hasRent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <CheckIcon className="h-3 w-3" />
              Renta Pagada ({money(metrics.rentCost)})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
              <AlertIcon className="h-3 w-3" />
              Renta Pendiente de Registro
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards Destacadas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card highlight>
          <div className="flex items-center justify-between">
            <CardLabel>Ventas Netas</CardLabel>
            <DollarIcon className="h-4 w-4 text-primary" />
          </div>
          <CardValue>{money(metrics.sales)}</CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            {metrics.saleCount} ventas completadas
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>Utilidad Bruta</CardLabel>
            <span className="text-xs font-bold text-on-surface-variant">
              {grossMarginPercent}% margen
            </span>
          </div>
          <CardValue className={grossProfit >= 0 ? "text-emerald-400" : "text-error"}>
            {money(grossProfit)}
          </CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            Ventas menos {money(metrics.cogs)} de insumos ({metrics.cogsPercent}%)
          </p>
        </Card>

        <Card
          className={
            metrics.operatingIncome >= 0
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : "border-error/40 bg-error/[0.05]"
          }
        >
          <div className="flex items-center justify-between">
            <CardLabel>Utilidad Operativa</CardLabel>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                metrics.operatingIncome >= 0
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-error/15 text-error"
              }`}
            >
              {metrics.operatingMarginPercent}%
            </span>
          </div>
          <CardValue
            className={metrics.operatingIncome >= 0 ? "text-emerald-400" : "text-error"}
          >
            {money(metrics.operatingIncome)}
          </CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            Margen operativo después de nómina y gastos fijos
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>Productividad Nómina</CardLabel>
            <UsersIcon className="h-4 w-4 text-on-surface-variant" />
          </div>
          <CardValue>{money(metrics.salesPerLaborHour)}/hr</CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            {metrics.laborCostPercent}% de ventas ({money(metrics.laborCost)} · {metrics.laborHours}h)
          </p>
        </Card>
      </div>

      {/* Alertas Operativas y Directivas */}
      {metrics.costAlerts.length > 0 ? (
        <div className="space-y-2">
          {criticalAlerts.map((alert, i) => (
            <div
              key={`crit-${i}`}
              className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/10 p-3.5 text-sm text-on-surface"
            >
              <span className="mt-0.5 rounded-md bg-error/20 p-1 text-error">
                <AlertIcon className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-error uppercase text-xs tracking-wider">
                    Alerta Crítica ({alert.category})
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium">{alert.message}</p>
              </div>
            </div>
          ))}

          {warningAlerts.map((alert, i) => (
            <div
              key={`warn-${i}`}
              className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm text-on-surface"
            >
              <span className="mt-0.5 rounded-md bg-amber-500/20 p-1 text-amber-400">
                <AlertIcon className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400 uppercase text-xs tracking-wider">
                    Advertencia ({alert.category})
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium">{alert.message}</p>
              </div>
            </div>
          ))}

          {infoAlerts.map((alert, i) => (
            <div
              key={`info-${i}`}
              className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-high/60 p-3 text-sm text-on-surface-variant"
            >
              <InfoIcon className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-xs">{alert.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" />
          <span>Salud financiera en rango: costos de insumos, nómina y rentas dentro de los parámetros esperados.</span>
        </div>
      )}

      {/* Grid: P&L Completo y Varianza de Inventario */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* P&L Detallado (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-outline-variant p-4">
              <h3 className="font-bold text-on-surface">
                Estado de Resultados Operativo (P&L)
              </h3>
              <p className="text-xs text-on-surface-variant">
                Estructura canónica de ingresos, costos directos y gastos de operación.
              </p>
            </div>

            <div className="divide-y divide-outline-variant/60 text-sm">
              {/* 1. Ingresos */}
              <div className="bg-surface-container/30 px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-on-surface">Ventas Netas Totales</span>
                  <span className="text-xs text-on-surface-variant block">
                    {metrics.saleCount} transacciones completadas
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-on-surface text-base">
                    {money(metrics.sales)}
                  </span>
                  <span className="text-xs text-on-surface-variant block">100.0%</span>
                </div>
              </div>

              {/* 2. Costo de Ventas */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-on-surface">
                    (−) Costo de Insumos / COGS
                  </span>
                  <span className="text-xs text-on-surface-variant block">
                    Recetas teóricas: {money(metrics.theoreticalCogs)} ({metrics.theoreticalCogsPercent}%)
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-error">
                    − {money(metrics.cogs)}
                  </span>
                  <span className="text-xs text-on-surface-variant block">
                    {metrics.cogsPercent}%
                  </span>
                </div>
              </div>

              {/* Subtotal: Utilidad Bruta */}
              <div className="bg-surface-container-high/40 px-4 py-2.5 flex items-center justify-between font-bold">
                <span className="text-on-surface">(=) Utilidad Bruta</span>
                <div className="text-right">
                  <span className={grossProfit >= 0 ? "text-emerald-400" : "text-error"}>
                    {money(grossProfit)}
                  </span>
                  <span className="text-xs text-on-surface-variant font-normal block">
                    {grossMarginPercent}% margen bruto
                  </span>
                </div>
              </div>

              {/* 3. Gastos de Operación (OPEX) */}
              <div className="px-4 py-3 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  (−) Gastos Operativos (OPEX)
                </p>

                {/* Nómina */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface">
                    Nómina y Mano de Obra ({metrics.laborHours} hrs)
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-on-surface">
                      − {money(metrics.laborCost)}
                    </span>
                    <span className="text-on-surface-variant block">
                      {metrics.laborCostPercent}%
                    </span>
                  </div>
                </div>

                {/* Renta */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface flex items-center gap-1.5">
                    Renta de Inmueble
                    {metrics.hasRent ? (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] text-emerald-400 font-semibold">
                        Registrada
                      </span>
                    ) : (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] text-amber-400 font-semibold">
                        Pendiente
                      </span>
                    )}
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-on-surface">
                      − {money(metrics.rentCost)}
                    </span>
                    <span className="text-on-surface-variant block">
                      {metrics.rentPercent}%
                    </span>
                  </div>
                </div>

                {/* Salidas de Caja Chica */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface">Salidas de Caja Chica (Cortes)</span>
                  <span className="font-medium text-on-surface">
                    − {money(metrics.cashOutflows)}
                  </span>
                </div>

                {/* Pagos Contables / Otros Gastos */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface">
                    Otros Pagos Contables y Fijos
                  </span>
                  <span className="font-medium text-on-surface">
                    − {money(metrics.otherExpenses)}
                  </span>
                </div>

                {/* Subtotal OPEX */}
                <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                  <span>Total Gastos Operativos</span>
                  <span>− {money(totalOpex)} ({opexPercent}%)</span>
                </div>
              </div>

              {/* 4. Resultado Operativo */}
              <div
                className={`px-4 py-3.5 flex items-center justify-between font-bold text-base ${
                  metrics.operatingIncome >= 0
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-error/10 text-error"
                }`}
              >
                <div>
                  <span className="block">(=) Utilidad Operativa Neta</span>
                  <span className="text-xs font-normal opacity-80">
                    EBITDA Operativo de {metrics.branchName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold">
                    {money(metrics.operatingIncome)}
                  </span>
                  <span className="text-xs font-semibold block opacity-90">
                    {metrics.operatingMarginPercent}% margen
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Varianza de Inventario y Productividad de Nómina (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Varianza de Inventario */}
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-on-surface">Control de Inventario y Fugas</h3>
              <PackageIcon className="h-4 w-4 text-on-surface-variant" />
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              Auditoría entre consumo registrado en almacén y recetas vendidas.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-surface-container-high/60 p-3 text-sm">
                <div>
                  <p className="font-semibold text-on-surface">Costo Registrado</p>
                  <p className="text-xs text-on-surface-variant">Salidas y ajustes de almacén</p>
                </div>
                <span className="font-bold text-on-surface">
                  {money(metrics.inventory.actualCost)}
                  {!metrics.inventory.actualCostKnown && "*"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-surface-container-high/60 p-3 text-sm">
                <div>
                  <p className="font-semibold text-on-surface">Costo Teórico Recetas</p>
                  <p className="text-xs text-on-surface-variant">Insumos requeridos por ventas</p>
                </div>
                <span className="font-bold text-on-surface">
                  {money(metrics.inventory.theoreticalCost)}
                  {!metrics.inventory.theoreticalCostKnown && "*"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-outline-variant p-3 text-sm">
                <div>
                  <p className="font-semibold text-on-surface">Desviación / Varianza</p>
                  <p className="text-xs text-on-surface-variant">
                    {metrics.costVariance > 0 ? "Sobreconsumo no justificado" : "Consumo alineado a recetas"}
                  </p>
                </div>
                <span
                  className={`font-bold ${
                    metrics.costVariance > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {money(metrics.costVariance)}
                </span>
              </div>

              {metrics.wasteCost > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-amber-400">Merma / Desecho Registrado</p>
                    <p className="text-xs text-on-surface-variant">Rotura, caducidad o ajuste</p>
                  </div>
                  <span className="font-bold text-amber-400">
                    {money(metrics.wasteCost)}
                  </span>
                </div>
              )}

              {(!metrics.inventory.actualCostKnown || !metrics.inventory.theoreticalCostKnown) && (
                <p className="text-[11px] text-on-surface-variant">
                  * Hay insumos con costo unitario pendiente en el catálogo.
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant">
              <Link
                href={`/accounting?branch=${metrics.branchId}&view=inventory`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver auditoría de recetas e insumos detallada →
              </Link>
            </div>
          </Card>

          {/* Productividad de Nómina */}
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-on-surface">Productividad de Personal</h3>
              <ClockIcon className="h-4 w-4 text-on-surface-variant" />
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              Eficiencia de la plantilla de trabajo durante el periodo.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-container-high/60 p-3">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Ventas / Hora
                </p>
                <p className="mt-1 text-lg font-bold text-on-surface">
                  {money(metrics.salesPerLaborHour)}
                </p>
                <p className="text-[11px] text-on-surface-variant">Generado por hora</p>
              </div>

              <div className="rounded-lg bg-surface-container-high/60 p-3">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Horas Totales
                </p>
                <p className="mt-1 text-lg font-bold text-on-surface">
                  {metrics.laborHours.toFixed(1)} h
                </p>
                <p className="text-[11px] text-on-surface-variant">Turnos laborados</p>
              </div>

              <div className="rounded-lg bg-surface-container-high/60 p-3">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  % Nómina / Ventas
                </p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    metrics.laborCostPercent > 35 ? "text-error" : "text-on-surface"
                  }`}
                >
                  {metrics.laborCostPercent}%
                </p>
                <p className="text-[11px] text-on-surface-variant">Meta óptima &lt; 30%</p>
              </div>

              <div className="rounded-lg bg-surface-container-high/60 p-3">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Monto Nómina
                </p>
                <p className="mt-1 text-lg font-bold text-on-surface">
                  {money(metrics.laborCost)}
                </p>
                <p className="text-[11px] text-on-surface-variant">Asignado a sucursal</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant">
              <Link
                href={`/accounting?branch=${metrics.branchId}&view=payroll`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver calendario de turnos y desglose por colaborador →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
