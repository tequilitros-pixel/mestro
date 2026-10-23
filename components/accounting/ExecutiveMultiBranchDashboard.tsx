import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { formatPaymentMoney } from "@/lib/accounting";
import type { MultiBranchFinancialOverview, BranchFinancialMetrics } from "@/lib/accounting/financialEngine";
import {
  AlertIcon,
  CheckIcon,
  CrownIcon,
  DollarIcon,
  FlameIcon,
  PackageIcon,
  ReceiptIcon,
  StoreIcon,
  UsersIcon,
} from "@/components/ui/icons";

interface ExecutiveMultiBranchDashboardProps {
  overview: MultiBranchFinancialOverview;
  period?: string;
  date?: string;
}

const money = formatPaymentMoney;

export function ExecutiveMultiBranchDashboard({
  overview,
  period = "month",
  date = "",
}: ExecutiveMultiBranchDashboardProps) {
  const { consolidated, branches } = overview;

  // Sucursal con mayor consumo de inventario / fuga (mayor COGS % o merma)
  const highestCogsBranch: BranchFinancialMetrics | undefined =
    branches.length > 0
      ? [...branches].sort(
          (a, b) => b.cogsPercent - a.cogsPercent || b.wasteCost - a.wasteCost || b.cogs - a.cogs
        )[0]
      : undefined;

  // Sucursal con mayor merma absoluta
  const highestWasteBranch: BranchFinancialMetrics | undefined =
    branches.length > 0
      ? [...branches].sort((a, b) => b.wasteCost - a.wasteCost)[0]
      : undefined;

  // Sucursal con mayor costo de nómina sobre ventas
  const highestLaborBranch: BranchFinancialMetrics | undefined =
    branches.length > 0
      ? [...branches].sort(
          (a, b) => b.laborCostPercent - a.laborCostPercent || b.laborCost - a.laborCost
        )[0]
      : undefined;

  // Sucursal más rentable / eficiente (mayor margen operativo con ventas > 0, o mayor utilidad)
  const branchesWithSales = branches.filter((b) => b.sales > 0);
  const mostEfficientBranch: BranchFinancialMetrics | undefined =
    branchesWithSales.length > 0
      ? [...branchesWithSales].sort(
          (a, b) => b.operatingMarginPercent - a.operatingMarginPercent || b.operatingIncome - a.operatingIncome
        )[0]
      : branches.length > 0
      ? [...branches].sort((a, b) => b.operatingIncome - a.operatingIncome)[0]
      : undefined;

  // Resumen de rentas
  const branchesWithRent = branches.filter((b) => b.hasRent);
  const branchesMissingRent = branches.filter((b) => !b.hasRent);

  // Parámetros para enlaces preservando filtros
  const branchHref = (branchId: string, view = "summary") => {
    const params = new URLSearchParams({
      branch: branchId,
      ...(period ? { period } : {}),
      ...(date ? { date } : {}),
      ...(view !== "summary" ? { view } : {}),
    });
    return `/accounting?${params.toString()}`;
  };

  return (
    <section aria-label="Tablero Ejecutivo Multi-Sucursal" className="space-y-6">
      {/* Encabezado del Tablero Directivo */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <StoreIcon className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Control Directivo Multi-Sucursal
            </p>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">
            Consolidado Ejecutivo Contable
          </h2>
          <p className="text-sm text-on-surface-variant">
            Métricas de {branches.length} sucursales ({overview.from} al {overview.to}). Decisiones de margen, inventario, nómina y rentas.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 font-medium text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Motor Financiero V2 Activo
          </span>
        </div>
      </div>

      {/* 1. Tarjetas KPI Consolidadas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Ventas Totales */}
        <Card highlight className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <CardLabel>Ventas Totales</CardLabel>
            <DollarIcon className="h-4 w-4 text-primary" />
          </div>
          <CardValue>{money(consolidated.sales)}</CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            {consolidated.saleCount.toLocaleString("es-MX")} tickets completados
          </p>
        </Card>

        {/* Costo de Insumos (% y $) */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <CardLabel>Costo Insumos (COGS)</CardLabel>
            <PackageIcon className="h-4 w-4 text-on-surface-variant" />
          </div>
          <CardValue className={consolidated.cogsPercent > 40 ? "text-error" : ""}>
            {consolidated.cogsPercent}%
          </CardValue>
          <div className="mt-1 flex items-center justify-between text-xs text-on-surface-variant">
            <span>{money(consolidated.cogs)}</span>
            {consolidated.wasteCost > 0 && (
              <span className="text-amber-400 font-medium" title="Merma y desecho registrado">
                Merma: {money(consolidated.wasteCost)}
              </span>
            )}
          </div>
        </Card>

        {/* Nómina (% y $) */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <CardLabel>Nómina (Labor Cost)</CardLabel>
            <UsersIcon className="h-4 w-4 text-on-surface-variant" />
          </div>
          <CardValue className={consolidated.laborCostPercent > 35 ? "text-error" : ""}>
            {consolidated.laborCostPercent}%
          </CardValue>
          <div className="mt-1 flex items-center justify-between text-xs text-on-surface-variant">
            <span>{money(consolidated.laborCost)}</span>
            <span>{money(consolidated.salesPerLaborHour)}/hr</span>
          </div>
        </Card>

        {/* Rentas y Gastos Fijos (% y $) */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <CardLabel>Rentas y Fijos</CardLabel>
            <ReceiptIcon className="h-4 w-4 text-on-surface-variant" />
          </div>
          <CardValue>
            {money(consolidated.rentCost + consolidated.otherExpenses)}
          </CardValue>
          <div className="mt-1 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Renta: {money(consolidated.rentCost)} ({consolidated.rentPercent}%)</span>
            <span>Otros: {money(consolidated.otherExpenses)}</span>
          </div>
        </Card>

        {/* Utilidad Operativa ($ y Margen %) */}
        <Card
          className={`relative overflow-hidden ${
            consolidated.operatingIncome >= 0
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : "border-error/40 bg-error/[0.05]"
          }`}
        >
          <div className="flex items-center justify-between">
            <CardLabel>Utilidad Operativa</CardLabel>
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                consolidated.operatingIncome >= 0
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-error/15 text-error"
              }`}
            >
              {consolidated.operatingMarginPercent}%
            </span>
          </div>
          <CardValue
            className={
              consolidated.operatingIncome >= 0 ? "text-emerald-400" : "text-error"
            }
          >
            {money(consolidated.operatingIncome)}
          </CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            Margen operativo neto consolidado
          </p>
        </Card>
      </div>

      {/* 2. Tarjetas de Decisión Directiva (Cards destacadas) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FlameIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Decisiones Directivas Inmediatas
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: ¿Qué sucursal consume más inventario / fuga? */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container/70 p-4 transition-all hover:border-outline">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-amber-500/15 p-2 text-amber-400">
                  <PackageIcon className="h-5 w-5" />
                </span>
                {highestCogsBranch && highestCogsBranch.cogsPercent > 35 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                    Alerta Costo
                  </span>
                )}
              </div>
              <h4 className="mt-3 text-sm font-semibold text-on-surface-variant">
                ¿Mayor consumo de inventario / fuga?
              </h4>
              {highestCogsBranch ? (
                <>
                  <p className="mt-1 text-xl font-bold text-on-surface">
                    {highestCogsBranch.branchName}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                    COGS del <strong className="text-on-surface">{highestCogsBranch.cogsPercent}%</strong> sobre sus ventas ({money(highestCogsBranch.cogs)}).
                    {highestWasteBranch && highestWasteBranch.wasteCost > 0 && (
                      <span className="block mt-1 text-amber-400 font-medium">
                        Merma registrada: {money(highestWasteBranch.wasteCost)} en {highestWasteBranch.branchName}.
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant">Sin datos registrados</p>
              )}
            </div>

            {highestCogsBranch && (
              <div className="mt-4 pt-3 border-t border-outline-variant/60">
                <Link
                  href={branchHref(highestCogsBranch.branchId, "inventory")}
                  className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                >
                  Auditar inventario de {highestCogsBranch.branchName} →
                </Link>
              </div>
            )}
          </div>

          {/* Card 2: ¿Qué sucursal se está pagando nómina de más? */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container/70 p-4 transition-all hover:border-outline">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-error/15 p-2 text-error">
                  <UsersIcon className="h-5 w-5" />
                </span>
                {highestLaborBranch && highestLaborBranch.laborCostPercent > 30 && (
                  <span className="rounded-full border border-error/30 bg-error/10 px-2.5 py-0.5 text-[11px] font-bold text-error">
                    Sobrecosto Nómina
                  </span>
                )}
              </div>
              <h4 className="mt-3 text-sm font-semibold text-on-surface-variant">
                ¿Mayor % de nómina sobre ventas?
              </h4>
              {highestLaborBranch ? (
                <>
                  <p className="mt-1 text-xl font-bold text-on-surface">
                    {highestLaborBranch.branchName}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                    Representa el <strong className="text-error">{highestLaborBranch.laborCostPercent}%</strong> de sus ventas ({money(highestLaborBranch.laborCost)} pagados).
                    <span className="block mt-1">
                      Productividad: {money(highestLaborBranch.salesPerLaborHour)} por hora hombre.
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant">Sin datos registrados</p>
              )}
            </div>

            {highestLaborBranch && (
              <div className="mt-4 pt-3 border-t border-outline-variant/60">
                <Link
                  href={branchHref(highestLaborBranch.branchId, "payroll")}
                  className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                >
                  Ver turnos y horas en {highestLaborBranch.branchName} →
                </Link>
              </div>
            )}
          </div>

          {/* Card 3: ¿Qué sucursal vende más con menos? */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container/70 p-4 transition-all hover:border-outline">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-emerald-500/15 p-2 text-emerald-400">
                  <CrownIcon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                  Máxima Eficiencia
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-on-surface-variant">
                ¿Qué sucursal vende más con menos?
              </h4>
              {mostEfficientBranch ? (
                <>
                  <p className="mt-1 text-xl font-bold text-on-surface">
                    {mostEfficientBranch.branchName}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                    Margen operativo de <strong className="text-emerald-400">{mostEfficientBranch.operatingMarginPercent}%</strong> ({money(mostEfficientBranch.operatingIncome)} de utilidad).
                    <span className="block mt-1">
                      Ventas: {money(mostEfficientBranch.sales)} · {money(mostEfficientBranch.salesPerLaborHour)}/hr.
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant">Sin ventas registradas</p>
              )}
            </div>

            {mostEfficientBranch && (
              <div className="mt-4 pt-3 border-t border-outline-variant/60">
                <Link
                  href={branchHref(mostEfficientBranch.branchId)}
                  className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                >
                  Desglose P&L de {mostEfficientBranch.branchName} →
                </Link>
              </div>
            )}
          </div>

          {/* Card 4: Monitoreo de Rentas */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container/70 p-4 transition-all hover:border-outline">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-primary/15 p-2 text-primary">
                  <ReceiptIcon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    branchesMissingRent.length === 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {branchesWithRent.length}/{branches.length} Pagadas
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-on-surface-variant">
                Monitoreo de Rentas del Periodo
              </h4>
              <p className="mt-1 text-lg font-bold text-on-surface">
                {money(consolidated.rentCost)}{" "}
                <span className="text-xs font-normal text-on-surface-variant">
                  ({consolidated.rentPercent}% ventas)
                </span>
              </p>
              <div className="mt-2 space-y-1">
                {branches.slice(0, 3).map((b) => (
                  <div
                    key={b.branchId}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate text-on-surface-variant">{b.branchName}</span>
                    {b.hasRent ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                        <CheckIcon className="h-3 w-3" /> {money(b.rentCost)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                        <AlertIcon className="h-3 w-3" /> Pendiente
                      </span>
                    )}
                  </div>
                ))}
                {branches.length > 3 && (
                  <p className="text-[11px] text-on-surface-variant pt-1">
                    + {branches.length - 3} sucursales más
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/60">
              <span className="text-xs text-on-surface-variant">
                {branchesMissingRent.length === 0
                  ? "Todas las rentas registradas al corriente."
                  : `${branchesMissingRent.length} sucursal(es) sin pago de renta registrado.`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Matriz Comparativa Multi-Sucursal */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-outline-variant p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-on-surface">
                Matriz Financiera Comparativa
              </h3>
              <p className="text-xs text-on-surface-variant">
                Compara ventas, insumos, merma, nómina, rentas y margen operativo sucursal por sucursal.
              </p>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              {branches.length} sucursales auditadas
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-high/60 text-xs font-semibold text-on-surface-variant">
              <tr>
                <th scope="col" className="px-4 py-3">Sucursal</th>
                <th scope="col" className="px-4 py-3 text-right">Ventas</th>
                <th scope="col" className="px-4 py-3 text-right">Insumos (COGS)</th>
                <th scope="col" className="px-4 py-3 text-right">Merma</th>
                <th scope="col" className="px-4 py-3 text-right">Nómina (Labor)</th>
                <th scope="col" className="px-4 py-3 text-right">Renta</th>
                <th scope="col" className="px-4 py-3 text-right">Otros Gastos</th>
                <th scope="col" className="px-4 py-3 text-right">Utilidad Operativa</th>
                <th scope="col" className="px-4 py-3 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {branches.map((b) => {
                const criticalAlerts = b.costAlerts.filter((a) => a.severity === "CRITICAL");
                const warningAlerts = b.costAlerts.filter((a) => a.severity === "WARNING");

                return (
                  <tr
                    key={b.branchId}
                    className="transition-colors hover:bg-surface-container-high/40"
                  >
                    {/* Sucursal (enlace) */}
                    <td className="px-4 py-3">
                      <Link
                        href={branchHref(b.branchId)}
                        className="font-semibold text-primary hover:underline flex items-center gap-1.5"
                      >
                        <StoreIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span>{b.branchName}</span>
                      </Link>
                      <span className="text-[11px] text-on-surface-variant block">
                        {b.saleCount} ventas
                      </span>
                    </td>

                    {/* Ventas */}
                    <td className="px-4 py-3 text-right font-medium text-on-surface">
                      {money(b.sales)}
                    </td>

                    {/* Insumos */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-on-surface block">
                        {money(b.cogs)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          b.cogsPercent > 40
                            ? "text-error"
                            : b.cogsPercent > 35
                            ? "text-amber-400"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {b.cogsPercent}%
                      </span>
                    </td>

                    {/* Merma $ */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          b.wasteCost > 0 ? "text-amber-400 font-semibold" : "text-on-surface-variant"
                        }`}
                      >
                        {money(b.wasteCost)}
                      </span>
                    </td>

                    {/* Nómina */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-on-surface block">
                        {money(b.laborCost)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          b.laborCostPercent > 35
                            ? "text-error"
                            : b.laborCostPercent > 30
                            ? "text-amber-400"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {b.laborCostPercent}%
                      </span>
                    </td>

                    {/* Renta */}
                    <td className="px-4 py-3 text-right">
                      {b.hasRent ? (
                        <>
                          <span className="font-medium text-on-surface block">
                            {money(b.rentCost)}
                          </span>
                          <span className="text-[11px] text-emerald-400 font-semibold">
                            {b.rentPercent}%
                          </span>
                        </>
                      ) : (
                        <span className="inline-block rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* Otros Gastos */}
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {money(b.otherExpenses)}
                    </td>

                    {/* Utilidad Operativa */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-bold block ${
                          b.operatingIncome >= 0 ? "text-emerald-400" : "text-error"
                        }`}
                      >
                        {money(b.operatingIncome)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          b.operatingMarginPercent >= 15
                            ? "text-emerald-400"
                            : b.operatingMarginPercent >= 0
                            ? "text-on-surface-variant"
                            : "text-error"
                        }`}
                      >
                        {b.operatingMarginPercent}% margen
                      </span>
                    </td>

                    {/* Alertas / Diagnóstico */}
                    <td className="px-4 py-3 text-center">
                      {criticalAlerts.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/15 px-2.5 py-1 text-xs font-bold text-error"
                          title={criticalAlerts.map((a) => a.message).join("\n")}
                        >
                          <AlertIcon className="h-3 w-3" />
                          {criticalAlerts.length} crítica{criticalAlerts.length > 1 ? "s" : ""}
                        </span>
                      ) : warningAlerts.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400"
                          title={warningAlerts.map((a) => a.message).join("\n")}
                        >
                          <AlertIcon className="h-3 w-3" />
                          {warningAlerts.length} aviso{warningAlerts.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                          <CheckIcon className="h-3 w-3" />
                          Óptimo
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totales Consolidados */}
            <tfoot className="border-t-2 border-outline-variant bg-surface-container-high/80 text-xs font-bold text-on-surface">
              <tr>
                <td className="px-4 py-3.5 uppercase tracking-wider text-primary">
                  Total Empresa
                </td>
                <td className="px-4 py-3.5 text-right font-extrabold text-sm">
                  {money(consolidated.sales)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="block text-sm font-extrabold">{money(consolidated.cogs)}</span>
                  <span className="text-[11px] text-on-surface-variant font-semibold">
                    {consolidated.cogsPercent}%
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-amber-400 font-extrabold text-sm">
                  {money(consolidated.wasteCost)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="block text-sm font-extrabold">{money(consolidated.laborCost)}</span>
                  <span className="text-[11px] text-on-surface-variant font-semibold">
                    {consolidated.laborCostPercent}%
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="block text-sm font-extrabold">{money(consolidated.rentCost)}</span>
                  <span className="text-[11px] text-on-surface-variant font-semibold">
                    {consolidated.rentPercent}%
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold">
                  {money(consolidated.otherExpenses)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span
                    className={`block text-sm font-extrabold ${
                      consolidated.operatingIncome >= 0 ? "text-emerald-400" : "text-error"
                    }`}
                  >
                    {money(consolidated.operatingIncome)}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-semibold">
                    {consolidated.operatingMarginPercent}% margen
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="text-on-surface-variant font-semibold">
                    {consolidated.costAlerts.length} alerta(s)
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </section>
  );
}
