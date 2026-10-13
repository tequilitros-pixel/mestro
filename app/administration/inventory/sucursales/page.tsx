import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStockMatrix, totalStockByProduct } from "../lib/stock";
import {
  InventoryFlowChart,
  InventoryBranchComparisonChart,
  InventoryPeriodComparisonChart,
  InventoryRankingChart,
  InventoryShareChart,
} from "../InventoryCharts";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { getInventoryDashboardData } from "../lib/dashboard";
import {
  ClipboardIcon,
  AlertIcon,
  PlusIcon,
  ChartLineIcon,
  StoreIcon,
  PackageIcon,
} from "@/components/ui/icons";
import PageTabs from "@/components/ui/PageTabs";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import {
  formatBusinessDate,
} from "@/lib/dateTime";

const formatDate = (value: Date) =>
  formatBusinessDate(value, { day: "2-digit", month: "short" });

const entryTypeLabels: Record<string, string> = {
  COMPRA: "Compra",
  TRASPASO: "Traspaso",
  AJUSTE: "Ajuste",
};

const quickActions = [
  { label: "Nueva entrada", href: "/administration/inventory/branch-entries", permissionKey: "/administration/inventory/branch-entries" },
  { label: "Entrada semanal", href: "/administration/inventory/branch-entries/weekly", permissionKey: "/administration/inventory/branch-entries" },
  {
    label: "Nuevo traspaso",
    href: "/administration/inventory/sucursales/traspasos",
    permissionKey: "/administration/inventory/sucursales/traspasos",
  },
  {
    label: "Nuevo conteo semanal",
    href: "/administration/inventory/branch-counts/new?type=WEEKLY",
    permissionKey: "/administration/inventory/branch-counts",
  },
  {
    label: "Nuevo conteo mensual",
    href: "/administration/inventory/branch-counts/new?type=MONTHLY",
    permissionKey: "/administration/inventory/branch-counts",
  },
];

export default async function SucursalesInventoryPage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();
  const permissionRows = user?.role === "ADMIN" ? [] : await prisma.modulePermission.findMany({
    where: { userId: user?.id ?? "" },
    select: { moduleKey: true },
  });
  const permissionKeys = new Set(permissionRows.map((permission) => permission.moduleKey));
  const visibleQuickActions = quickActions.filter(
    (action) => user?.role === "ADMIN" || permissionKeys.has(action.permissionKey),
  );
  const branchFilter = allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };

  const [products, recentEntries, dashboard] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { isActive: true, archivedAt: null, trackStock: true },
      select: { id: true, name: true, unit: true, minimumStock: true },
    }),
    prisma.inventoryEntry.findMany({
      where: branchFilter,
      orderBy: { entryDate: "desc" },
      take: 12,
      include: { product: true, branch: true },
    }),
    getInventoryDashboardData(allowedBranchIds),
  ]);

  const matrix = await computeStockMatrix(products.map((p) => p.id), allowedBranchIds);

  const lowStockProducts = products
    .map((product) => ({
      ...product,
      stock: totalStockByProduct(matrix, product.id),
    }))
    .filter(
      (product) =>
        Number(product.minimumStock) > 0 &&
        product.stock < Number(product.minimumStock)
    )
    .sort((a, b) => a.stock - b.stock);

  const control = dashboard.analytics;
  const weekly = dashboard.weeklyAnalytics;
  const mostConsumedProduct = control.topProducts[0] ?? null;
  const mostConsumedProductWeekly = weekly.topProducts[0] ?? null;
  const mostActiveBranch = [...control.branches].sort((a, b) => b.consumed - a.consumed)[0] ?? null;
  const mostActiveBranchWeekly = [...weekly.branches].sort((a, b) => b.consumed - a.consumed)[0] ?? null;
  const mostWastefulBranch = [...control.branches].sort((a, b) => b.waste - a.waste)[0] ?? null;
  const mostMismatchedBranch = [...control.branches].sort((a, b) => b.mismatchUnits - a.mismatchUnits)[0] ?? null;
  const mismatchProducts = [...control.topProducts]
    .filter((product) => product.mismatches > 0)
    .sort((a, b) => b.mismatchUnits - a.mismatchUnits)
    .slice(0, 12);
  const branchComparison = [...control.branches]
    .filter((branch) => branch.consumed > 0 || branch.waste > 0 || branch.mismatchUnits > 0)
    .sort((a, b) => Math.max(b.consumed, b.waste, b.mismatchUnits) - Math.max(a.consumed, a.waste, a.mismatchUnits))
    .slice(0, 10)
    .map((branch) => ({
      name: branch.name,
      consumed: Math.round(branch.consumed * 10) / 10,
      waste: Math.round(branch.waste * 10) / 10,
      mismatchUnits: Math.round(branch.mismatchUnits * 10) / 10,
    }));
  const weeklyBranchById = new Map(weekly.branches.map((branch) => [branch.id, branch]));
  const branchPeriodComparison = control.branches
    .map((branch) => ({
      name: branch.name,
      weekly: Math.round((weeklyBranchById.get(branch.id)?.consumed ?? 0) * 10) / 10,
      monthly: Math.round(branch.consumed * 10) / 10,
    }))
    .filter((branch) => branch.weekly > 0 || branch.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 10);
  const productPeriodById = new Map<string, { name: string; weekly: number; monthly: number; unit: string }>();
  for (const product of weekly.topProducts) {
    productPeriodById.set(product.id, { name: product.name, weekly: product.consumed, monthly: 0, unit: product.unit });
  }
  for (const product of control.topProducts) {
    const current = productPeriodById.get(product.id);
    productPeriodById.set(product.id, {
      name: product.name,
      weekly: current?.weekly ?? 0,
      monthly: product.consumed,
      unit: product.unit,
    });
  }
  const productPeriodComparison = Array.from(productPeriodById.values())
    .filter((product) => product.weekly > 0 || product.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 10)
    .map(({ name, weekly: weeklyConsumed, monthly: monthlyConsumed }) => ({
      name,
      weekly: Math.round(weeklyConsumed * 10) / 10,
      monthly: Math.round(monthlyConsumed * 10) / 10,
    }));
  const productPeriodRows = Array.from(productPeriodById.values())
    .filter((product) => product.weekly > 0 || product.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 12);
  const negativeRows = dashboard.negativeLegacy.slice(0, 20);
  const negativeByBranch = Array.from(
    dashboard.negativeLegacy.reduce((map, row) => {
      const current = map.get(row.branchId) ?? { branchName: row.branchName, count: 0 };
      current.count += 1;
      map.set(row.branchId, current);
      return map;
    }, new Map<string, { branchName: string; count: number }>()),
  ).map(([branchId, value]) => ({ branchId, ...value })).sort((a, b) => b.count - a.count);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/administration/inventory"
              className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
            >
              ← Inventario
            </Link>
            <h1 className="text-3xl font-bold sm:text-4xl">
              Inventario de sucursales
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
              Stock por sucursal, movimientos y conteos semanales.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleQuickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
              >
                <PlusIcon className="h-4 w-4" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <PageTabs
          tabs={[
            {
              key: "control",
              label: "Control y decisiones",
              icon: <ChartLineIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-on-surface">
                      Lectura ejecutiva del inventario
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      Últimos {control.days} días. Sirve para decidir qué surtir, qué revisar y dónde actuar primero.
                    </p>
                  </div>

                  <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
                    <Card>
                      <CardLabel>Consumo neto</CardLabel>
                      <CardValue>{control.totals.consumedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        unidades · {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(control.totals.consumedCost)}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Mermas</CardLabel>
                      <CardValue>{control.totals.wasteUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        costo {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(control.totals.wasteCost)}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Diferencias</CardLabel>
                      <CardValue>{control.totals.mismatchCount}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {control.totals.mismatchUnits.toFixed(1)} unidades · faltantes {control.totals.shortageUnits.toFixed(1)}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Producto más consumido</CardLabel>
                      <p className="mt-1 truncate text-lg font-bold text-on-surface">
                        {mostConsumedProduct?.name ?? "Sin datos"}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {mostConsumedProduct ? `${mostConsumedProduct.consumed.toFixed(1)} ${mostConsumedProduct.unit}` : "Todavía no hay salidas"}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Más consumo</CardLabel>
                      <p className="mt-1 truncate text-lg font-bold text-on-surface">
                        {mostActiveBranch?.name ?? "Sin datos"}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {mostActiveBranch ? `${mostActiveBranch.consumed.toFixed(1)} unidades` : "Todavía no hay salidas"}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Entradas del periodo</CardLabel>
                      <CardValue>{control.totals.receivedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {control.totals.movements} movimientos registrados
                      </p>
                    </Card>
                  </section>

                  <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
                    <Card>
                      <CardLabel>Consumo · 7 días</CardLabel>
                      <CardValue>{weekly.totals.consumedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {weekly.totals.movements} movimientos
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Entradas · 7 días</CardLabel>
                      <CardValue>{weekly.totals.receivedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">unidades recibidas</p>
                    </Card>
                    <Card>
                      <CardLabel>Mermas · 7 días</CardLabel>
                      <CardValue>{weekly.totals.wasteUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">pérdidas registradas</p>
                    </Card>
                    <Card>
                      <CardLabel>Diferencias · 7 días</CardLabel>
                      <CardValue>{weekly.totals.mismatchCount}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">{weekly.totals.mismatchUnits.toFixed(1)} unidades</p>
                    </Card>
                    <Card>
                      <CardLabel>Producto líder · 7 días</CardLabel>
                      <p className="mt-1 truncate text-lg font-bold text-on-surface">
                        {mostConsumedProductWeekly?.name ?? "Sin datos"}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {mostConsumedProductWeekly ? `${mostConsumedProductWeekly.consumed.toFixed(1)} ${mostConsumedProductWeekly.unit}` : "Sin salidas"}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Sucursal líder · 7 días</CardLabel>
                      <p className="mt-1 truncate text-lg font-bold text-on-surface">
                        {mostActiveBranchWeekly?.name ?? "Sin datos"}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {mostActiveBranchWeekly ? `${mostActiveBranchWeekly.consumed.toFixed(1)} unidades` : "Sin salidas"}
                      </p>
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Consumo por sucursal · semanal vs mensual</CardLabel>
                      {branchPeriodComparison.length > 0 ? (
                        <InventoryPeriodComparisonChart data={branchPeriodComparison} />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin consumo registrado.</p>
                      )}
                    </Card>
                    <Card>
                      <CardLabel>Productos que más se mueven · semanal vs mensual</CardLabel>
                      {productPeriodComparison.length > 0 ? (
                        <InventoryPeriodComparisonChart data={productPeriodComparison} />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin consumo registrado.</p>
                      )}
                    </Card>
                  </section>

                  <Card>
                    <CardLabel>Productos con más movimiento · semanal y mensual</CardLabel>
                    {productPeriodRows.length === 0 ? (
                      <p className="mt-3 text-sm text-on-surface-variant">No hay consumo registrado en los periodos seleccionados.</p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead>
                            <tr className="border-b border-outline-variant text-left text-xs text-outline">
                              <th className="pb-2 font-medium">Producto</th>
                              <th className="pb-2 text-right font-medium">7 días</th>
                              <th className="pb-2 text-right font-medium">30 días</th>
                              <th className="pb-2 text-right font-medium">Unidad</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {productPeriodRows.map((product) => (
                              <tr key={product.name}>
                                <td className="py-3 font-semibold text-on-surface">{product.name}</td>
                                <td className="py-3 text-right text-secondary">{product.weekly.toFixed(1)}</td>
                                <td className="py-3 text-right text-on-surface-variant">{product.monthly.toFixed(1)}</td>
                                <td className="py-3 text-right text-on-surface-variant">{product.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  <section className="grid gap-4 lg:grid-cols-3">
                    <Card>
                      <CardLabel>Evolución · últimos 30 días</CardLabel>
                      <InventoryFlowChart data={control.daily} />
                    </Card>
                    <Card>
                      <CardLabel>Evolución · últimos 7 días</CardLabel>
                      <InventoryFlowChart data={weekly.daily} />
                    </Card>
                    <Card>
                      <CardLabel>Tipos de movimiento</CardLabel>
                      {control.movementTypes.length > 0 ? (
                        <InventoryShareChart
                          data={control.movementTypes.map((item) => ({ name: item.name, value: item.movements }))}
                        />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin movimientos en el periodo.</p>
                      )}
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Consumo, merma y diferencias por sucursal</CardLabel>
                      {branchComparison.length > 0 ? (
                        <InventoryBranchComparisonChart data={branchComparison} />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin datos de sucursales en el periodo.</p>
                      )}
                    </Card>
                    <Card>
                      <CardLabel>Productos con más consumo</CardLabel>
                      {control.topProducts.length > 0 ? (
                        <InventoryRankingChart
                          data={control.topProducts.slice(0, 8).map((item) => ({ name: item.name, value: Math.round(item.consumed * 10) / 10 }))}
                          valueLabel="Unidades consumidas"
                        />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin consumo registrado.</p>
                      )}
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-3">
                    <Card>
                      <CardLabel>Sucursal con más merma</CardLabel>
                      <p className="mt-3 text-lg font-bold text-on-surface">{mostWastefulBranch?.name ?? "Sin datos"}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {mostWastefulBranch ? `${mostWastefulBranch.waste.toFixed(1)} unidades · ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(mostWastefulBranch.wasteCost)}` : "Sin mermas registradas"}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Sucursal con más diferencias</CardLabel>
                      <p className="mt-3 text-lg font-bold text-on-surface">{mostMismatchedBranch?.name ?? "Sin datos"}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {mostMismatchedBranch ? `${mostMismatchedBranch.mismatches} productos · ${mostMismatchedBranch.shortageUnits.toFixed(1)} unidades faltantes` : "Sin diferencias registradas"}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Inventario valorizado por sucursal</CardLabel>
                      <div className="mt-3 space-y-2 text-sm">
                        {control.branches.slice(0, 5).map((branch) => (
                          <div key={branch.id} className="flex items-center justify-between gap-3">
                            <span className="truncate text-on-surface">{branch.name}</span>
                            <span className="shrink-0 font-semibold text-on-surface-variant">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(branch.currentStockValue)}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Consumo por sucursal · semanal y mensual</CardLabel>
                      {control.branches.length === 0 ? (
                        <p className="mt-3 text-sm text-on-surface-variant">No hay sucursales visibles.</p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full min-w-[860px] text-sm">
                            <thead>
                              <tr className="border-b border-outline-variant text-left text-xs text-outline">
                                <th className="pb-2 font-medium">Sucursal</th>
                                <th className="pb-2 text-right font-medium">7 días</th>
                                <th className="pb-2 text-right font-medium">30 días</th>
                                <th className="pb-2 text-right font-medium">Costo</th>
                                <th className="pb-2 text-right font-medium">Merma</th>
                                <th className="pb-2 text-right font-medium">Diferencias</th>
                                <th className="pb-2 text-right font-medium">Bajo mínimo</th>
                                <th className="pb-2 text-right font-medium">Negativos</th>
                                <th className="pb-2 text-right font-medium">Stock $</th>
                                <th className="pb-2 text-right font-medium">Movimientos</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                              {control.branches.map((branch, index) => (
                                <tr key={branch.id}>
                                  <td className="py-3 font-semibold text-on-surface">
                                    <span className="mr-2 text-xs text-outline">#{index + 1}</span>{branch.name}
                                  </td>
                                  <td className="py-3 text-right text-secondary">{(weeklyBranchById.get(branch.id)?.consumed ?? 0).toFixed(1)}</td>
                                  <td className="py-3 text-right text-on-surface-variant">{branch.consumed.toFixed(1)}</td>
                                  <td className="py-3 text-right text-on-surface-variant">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(branch.consumedCost)}</td>
                                  <td className="py-3 text-right text-error">{branch.waste.toFixed(1)}</td>
                                  <td className="py-3 text-right text-secondary">{branch.mismatches} · {branch.mismatchUnits.toFixed(1)}</td>
                                  <td className="py-3 text-right text-on-surface-variant">{branch.lowStockCount}</td>
                                  <td className="py-3 text-right text-error">{branch.negativeProductCount}</td>
                                  <td className="py-3 text-right text-on-surface-variant">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(branch.currentStockValue)}</td>
                                  <td className="py-3 text-right text-on-surface-variant">{branch.movements}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    <Card>
                      <CardLabel>Existencias negativas detectadas</CardLabel>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Revisa primero estas filas: representan saldos históricos sin una existencia V2 que los respalde.
                      </p>
                      {negativeByBranch[0] && (
                        <p className="mt-3 text-sm font-semibold text-error">
                          Más incidencias: {negativeByBranch[0].branchName} ({negativeByBranch[0].count})
                        </p>
                      )}
                      {negativeRows.length === 0 ? (
                        <p className="mt-4 text-sm text-on-surface-variant">No hay negativos históricos detectados.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {negativeRows.map((row) => (
                            <div key={`${row.branchId}:${row.productId}`} className="flex items-center justify-between gap-4 rounded-xl border border-error/20 bg-error/5 px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-on-surface">{row.productName}</p>
                                <p className="truncate text-xs text-on-surface-variant">{row.branchName}</p>
                              </div>
                              <span className="shrink-0 font-bold text-error">{row.displayQuantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-3">
                    <Card>
                      <CardLabel>Alertas de reposición</CardLabel>
                      <p className={`mt-1 text-3xl font-bold ${control.totals.lowStockCount > 0 ? "text-error" : "text-on-surface"}`}>
                        {control.totals.lowStockCount}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">productos bajo mínimo · {control.totals.outOfStockCount} agotados</p>
                    </Card>
                    <Card>
                      <CardLabel>Diferencias de conteo recientes</CardLabel>
                      <p className={`mt-1 text-3xl font-bold ${dashboard.recentDifferences.length > 0 ? "text-secondary" : "text-on-surface"}`}>
                        {dashboard.recentDifferences.length}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">declaraciones con diferencia contra lo esperado</p>
                    </Card>
                    <Card>
                      <CardLabel>Configuración pendiente</CardLabel>
                      <p className={`mt-1 text-3xl font-bold ${dashboard.incompletePresentations.length > 0 ? "text-secondary" : "text-on-surface"}`}>
                        {dashboard.incompletePresentations.length}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">productos sin conversión comercial completa</p>
                    </Card>
                  </section>

                  {dashboard.recentDifferences.length > 0 && (
                    <Card>
                      <CardLabel>Últimas diferencias de conteo</CardLabel>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                          <thead>
                            <tr className="border-b border-outline-variant text-left text-xs text-outline">
                              <th className="pb-2 font-medium">Sucursal</th>
                              <th className="pb-2 font-medium">Producto</th>
                              <th className="pb-2 text-right font-medium">Esperado</th>
                              <th className="pb-2 text-right font-medium">Declarado</th>
                              <th className="pb-2 text-right font-medium">Diferencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {dashboard.recentDifferences.slice(0, 12).map((difference) => (
                              <tr key={difference.id}>
                                <td className="py-3 text-on-surface-variant">{difference.branchName}</td>
                                <td className="py-3 font-semibold text-on-surface">{difference.productName}</td>
                                <td className="py-3 text-right text-on-surface-variant">{difference.expected}</td>
                                <td className="py-3 text-right text-on-surface-variant">{difference.declared}</td>
                                <td className={`py-3 text-right font-bold ${difference.difference.startsWith("-") ? "text-error" : "text-secondary"}`}>{difference.difference}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {mismatchProducts.length > 0 && (
                    <Card>
                      <CardLabel>Productos que no coinciden en los conteos del periodo</CardLabel>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                          <thead>
                            <tr className="border-b border-outline-variant text-left text-xs text-outline">
                              <th className="pb-2 font-medium">Producto</th>
                              <th className="pb-2 text-right font-medium">Conteos con diferencia</th>
                              <th className="pb-2 text-right font-medium">Unidades</th>
                              <th className="pb-2 text-right font-medium">Consumo del mes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {mismatchProducts.map((product) => (
                              <tr key={product.id}>
                                <td className="py-3 font-semibold text-on-surface">{product.name}</td>
                                <td className="py-3 text-right text-secondary">{product.mismatches}</td>
                                <td className="py-3 text-right text-secondary">{product.mismatchUnits.toFixed(1)} {product.unit}</td>
                                <td className="py-3 text-right text-on-surface-variant">{product.consumed.toFixed(1)} {product.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Link href="/administration/inventory/sucursales/stock" className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/40">
                      <StoreIcon className="h-4 w-4" /> Ver stock por sucursal
                    </Link>
                    <Link href="/administration/inventory/branch-counts" className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/40">
                      <PackageIcon className="h-4 w-4" /> Revisar conteos
                    </Link>
                  </div>
                </div>
              ),
            },
            {
              key: "resumen",
              label: "Resumen",
              icon: <ChartLineIcon className="h-4 w-4" />,
              content: (
                <>
                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                      <h2 className="mb-4 text-sm font-semibold text-on-surface-variant">
                        Evolución del inventario · últimos 30 días
                      </h2>
                      <InventoryFlowChart data={control.daily} />
                    </div>

                    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                      <h2 className="mb-4 text-sm font-semibold text-on-surface-variant">
                        Evolución del inventario · últimos 7 días
                      </h2>
                      <InventoryFlowChart data={weekly.daily} />
                    </div>
                  </section>

                  <section className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                      <h2 className="mb-4 text-sm font-semibold text-on-surface-variant">
                        Consumo por sucursal · semanal vs mensual
                      </h2>
                      <InventoryPeriodComparisonChart data={branchPeriodComparison} />
                    </div>

                    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                      <h2 className="mb-4 text-sm font-semibold text-on-surface-variant">
                        Productos con más movimiento · semanal vs mensual
                      </h2>
                      <InventoryPeriodComparisonChart data={productPeriodComparison} />
                    </div>
                  </section>

                  <section className="mt-5 grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardLabel>Consumo semanal</CardLabel>
                      <CardValue>{weekly.totals.consumedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">unidades en 7 días</p>
                    </Card>
                    <Card>
                      <CardLabel>Consumo mensual</CardLabel>
                      <CardValue>{control.totals.consumedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">unidades en 30 días</p>
                    </Card>
                    <Card>
                      <CardLabel>Merma semanal</CardLabel>
                      <CardValue>{weekly.totals.wasteUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">unidades registradas</p>
                    </Card>
                    <Card>
                      <CardLabel>Diferencias mensuales</CardLabel>
                      <CardValue>{control.totals.mismatchCount}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">en declaraciones de conteo</p>
                    </Card>
                  </section>

                  <section className="mt-5">

                    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                        <AlertIcon className="h-4 w-4 text-error" />
                        Alertas de stock bajo
                      </h2>

                      {lowStockProducts.length === 0 && (
                        <p className="text-sm text-on-surface-variant">
                          Ningún insumo está por debajo de su mínimo.
                        </p>
                      )}

                      <div className="space-y-3">
                        {lowStockProducts.slice(0, 8).map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-on-surface">
                              {product.name}
                            </span>
                            <span className="text-error">
                              {product.stock.toFixed(1)} / min{" "}
                              {Number(product.minimumStock)} {product.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      {lowStockProducts.length > 0 && (
                        <Link
                          href="/administration/inventory/sucursales/stock"
                          className="mt-4 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                        >
                          Ver stock completo →
                        </Link>
                      )}
                    </div>
                  </section>
                </>
              ),
            },
            {
              key: "movimientos",
              label: "Movimientos",
              icon: <ClipboardIcon className="h-4 w-4" />,
              content: (
                <>
                  <section className="rounded-2xl border border-outline-variant bg-surface-container">
                    <div className="flex items-center justify-between p-5 pb-0">
                      <h2 className="text-sm font-semibold text-on-surface-variant">
                        Movimientos recientes
                      </h2>
                    </div>

                    <div className="overflow-x-auto p-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-on-surface-variant">
                            <th className="px-2 py-2">Fecha</th>
                            <th className="px-2 py-2">Tipo</th>
                            <th className="px-2 py-2">Producto</th>
                            <th className="px-2 py-2">Sucursal</th>
                            <th className="px-2 py-2 text-right">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentEntries.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-2 py-6 text-center text-on-surface-variant"
                              >
                                Aún no hay movimientos registrados.
                              </td>
                            </tr>
                          )}
                          {recentEntries.map((entry) => {
                            const quantity = Number(entry.quantity);
                            const productName = entry.product?.name ?? "Producto no disponible";
                            const productUnit = entry.product?.unit ?? "";
                            const branchName = entry.branch?.name ?? "Sucursal no disponible";
                            return (
                              <tr
                                key={entry.id}
                                className="border-t border-outline-variant last:border-0 hover:bg-surface-container-high/50"
                              >
                                <td className="px-2 py-3">
                                  {formatDate(new Date(entry.entryDate))}
                                </td>
                                <td className="px-2 py-3">
                                  {entryTypeLabels[entry.type] ?? entry.type}
                                </td>
                                <td className="px-2 py-3">
                                  {productName}
                                </td>
                                <td className="px-2 py-3">
                                  {branchName}
                                </td>
                                <td
                                  className={`px-2 py-3 text-right ${
                                    quantity < 0
                                      ? "text-error"
                                      : "text-on-surface"
                                  }`}
                                >
                                  {quantity > 0 ? "+" : ""}
                                  {quantity} {productUnit}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
