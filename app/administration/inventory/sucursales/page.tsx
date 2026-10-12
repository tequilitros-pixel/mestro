import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStockMatrix, totalStockByProduct } from "../lib/stock";
import InventoryTrendChart from "../InventoryTrendChart";
import {
  InventoryFlowChart,
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
  addBusinessDays,
  businessDayStart,
  formatBusinessDate,
  formatBusinessDateOnly,
  formatCivilDate,
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
  const today = formatBusinessDateOnly(new Date());
  const fourteenDaysAgo = businessDayStart(addBusinessDays(today, -14));
  const branchFilter = allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };

  const [products, recentEntries, entriesForTrend, dashboard] = await Promise.all([
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
    prisma.inventoryEntry.findMany({
      where: { entryDate: { gte: fourteenDaysAgo }, ...branchFilter },
      select: { entryDate: true },
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

  const trendMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    trendMap.set(addBusinessDays(today, -i), 0);
  }
  for (const entry of entriesForTrend) {
    const key = formatBusinessDateOnly(entry.entryDate);
    if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  }
  const trendData = Array.from(trendMap.entries()).map(([key, count]) => ({
    date: formatCivilDate(`${key}T00:00:00.000Z`, { day: "2-digit", month: "short" }),
    label: formatCivilDate(`${key}T00:00:00.000Z`, { day: "2-digit" }),
    movimientos: count,
  }));
  const control = dashboard.analytics;
  const mostConsumedProduct = control.topProducts[0] ?? null;
  const mostActiveBranch = control.branches[0] ?? null;
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

                  <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Card>
                      <CardLabel>Salidas consumidas</CardLabel>
                      <CardValue>{control.totals.consumedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        unidades · costo {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(control.totals.consumedCost)}
                      </p>
                    </Card>
                    <Card>
                      <CardLabel>Entradas recibidas</CardLabel>
                      <CardValue>{control.totals.receivedUnits.toFixed(1)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {control.totals.movements} movimientos registrados
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
                      <CardLabel>Sucursal con más consumo</CardLabel>
                      <p className="mt-1 truncate text-lg font-bold text-on-surface">
                        {mostActiveBranch?.name ?? "Sin datos"}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {mostActiveBranch ? `${mostActiveBranch.consumed.toFixed(1)} unidades` : "Todavía no hay salidas"}
                      </p>
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Evolución de entradas y salidas</CardLabel>
                      <InventoryFlowChart data={control.daily} />
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
                      <CardLabel>Productos que más se mueven</CardLabel>
                      {control.topProducts.length > 0 ? (
                        <InventoryRankingChart
                          data={control.topProducts.slice(0, 8).map((item) => ({ name: item.name, value: Math.round(item.consumed * 10) / 10 }))}
                          valueLabel="Unidades consumidas"
                        />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin consumo registrado.</p>
                      )}
                    </Card>
                    <Card>
                      <CardLabel>Consumo por sucursal</CardLabel>
                      {control.branches.length > 0 ? (
                        <InventoryRankingChart
                          data={control.branches.map((item) => ({ name: item.name, value: Math.round(item.consumed * 10) / 10 }))}
                          valueLabel="Unidades consumidas"
                        />
                      ) : (
                        <p className="py-12 text-center text-sm text-on-surface-variant">Sin consumo registrado.</p>
                      )}
                    </Card>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Ranking de sucursales</CardLabel>
                      {control.branches.length === 0 ? (
                        <p className="mt-3 text-sm text-on-surface-variant">No hay movimientos en el periodo.</p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full min-w-[520px] text-sm">
                            <thead>
                              <tr className="border-b border-outline-variant text-left text-xs text-outline">
                                <th className="pb-2 font-medium">Sucursal</th>
                                <th className="pb-2 text-right font-medium">Salidas</th>
                                <th className="pb-2 text-right font-medium">Costo</th>
                                <th className="pb-2 text-right font-medium">Movimientos</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                              {control.branches.map((branch, index) => (
                                <tr key={branch.id}>
                                  <td className="py-3 font-semibold text-on-surface">
                                    <span className="mr-2 text-xs text-outline">#{index + 1}</span>{branch.name}
                                  </td>
                                  <td className="py-3 text-right text-on-surface-variant">{branch.consumed.toFixed(1)}</td>
                                  <td className="py-3 text-right text-on-surface-variant">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(branch.cost)}</td>
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
                  <section className="grid gap-5 lg:grid-cols-3">
                    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5 lg:col-span-2">
                      <h2 className="mb-4 text-sm font-semibold text-on-surface-variant">
                        Movimientos de inventario (últimos 14 días)
                      </h2>
                      <InventoryTrendChart data={trendData} />
                    </div>

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
                                  {entry.product.name}
                                </td>
                                <td className="px-2 py-3">
                                  {entry.branch.name}
                                </td>
                                <td
                                  className={`px-2 py-3 text-right ${
                                    quantity < 0
                                      ? "text-error"
                                      : "text-on-surface"
                                  }`}
                                >
                                  {quantity > 0 ? "+" : ""}
                                  {quantity} {entry.product.unit}
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
