import Link from "next/link";
import {
  PackageIcon,
  PartyIcon,
  StoreIcon,
  ChevronRightIcon,
  HomeIcon,
  GridIcon,
  AlertIcon,
  ChartLineIcon,
} from "@/components/ui/icons";
import PageTabs from "@/components/ui/PageTabs";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { getInventoryAnalytics } from "./lib/analytics";
import {
  InventoryRankingChart,
  InventoryFlowChart,
  InventoryShareChart,
} from "./InventoryCharts";

const sections = [
  {
    title: "Inventario de eventos",
    description:
      "Paquetes, kits de equipo y control de salida/regreso de cada evento.",
    href: "/administration/inventory/eventos",
    icon: <PartyIcon className="h-6 w-6 text-on-surface-variant" />,
  },
  {
    title: "Inventario de sucursales",
    description: "Stock por sucursal, entradas, traspasos y conteos semanales.",
    href: "/administration/inventory/sucursales",
    icon: <StoreIcon className="h-6 w-6 text-on-surface-variant" />,
  },
  {
    title: "Productos",
    description:
      "Catálogo compartido de bebidas, insumos, herramientas y equipo.",
    href: "/administration/inventory/products",
    icon: <PackageIcon className="h-6 w-6 text-on-surface-variant" />,
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const units = (value: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value);

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Nunca";

export default async function InventoryPage() {
  const analytics = await getInventoryAnalytics();
  const { totals, topProducts, categories, branches, movementTypes, daily, lowStock, stale } =
    analytics;

  const shortcuts = (
    <section className="grid gap-5 md:grid-cols-3">
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="group rounded-2xl border border-outline-variant bg-surface-container p-6 transition duration-200 ease-out hover:-translate-y-1 hover:border-primary/25"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high">
            {section.icon}
          </div>

          <h2 className="text-xl font-semibold text-on-surface">{section.title}</h2>

          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {section.description}
          </p>

          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
            Abrir
            <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </section>
  );

  const alertCount =
    totals.lowStockCount + totals.outOfStockCount + totals.staleCount;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="mb-2 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
            Administración
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">Inventario</h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Qué se consume, dónde y qué está por acabarse. Últimos {analytics.days} días.
          </p>
        </div>

        <PageTabs
          tabs={[
            {
              key: "resumen",
              label: "Resumen",
              icon: <HomeIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Card>
                      <CardLabel>Consumo del periodo</CardLabel>
                      <CardValue>{money(totals.consumedCost)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {units(totals.consumedUnits)} unidades salidas
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Movimientos</CardLabel>
                      <CardValue>{totals.movements}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {units(totals.receivedUnits)} unidades entradas
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Productos activos</CardLabel>
                      <CardValue>{totals.activeProducts}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        de {totals.products} en catálogo
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Requieren atención</CardLabel>
                      <p
                        className={`text-2xl font-bold ${
                          alertCount > 0 ? "text-error" : "text-on-surface"
                        }`}
                      >
                        {alertCount}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Bajo mínimo, agotado o parado
                      </p>
                    </Card>
                  </div>

                  {topProducts.length === 0 ? (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        No hay movimientos de inventario en los últimos{" "}
                        {analytics.days} días.
                      </p>
                    </Card>
                  ) : (
                    <>
                      <Card>
                        <CardLabel>Entradas y salidas por día</CardLabel>
                        <InventoryFlowChart data={daily} />
                      </Card>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <CardLabel>Productos más usados</CardLabel>
                          <InventoryRankingChart
                            data={topProducts.slice(0, 8).map((p) => ({
                              name: p.name,
                              value: Math.round(p.consumed * 10) / 10,
                            }))}
                            valueLabel="Consumo"
                          />
                        </Card>

                        <Card>
                          <CardLabel>Tipos de movimiento</CardLabel>
                          <InventoryShareChart
                            data={movementTypes.map((t) => ({
                              name: t.name,
                              value: t.movements,
                            }))}
                          />
                        </Card>
                      </div>
                    </>
                  )}

                  {shortcuts}
                </div>
              ),
            },

            {
              key: "productos",
              label: "Productos más usados",
              icon: <PackageIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {topProducts.length === 0 ? (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        Sin movimientos en este periodo.
                      </p>
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <CardLabel>Top 10 por unidades consumidas</CardLabel>
                          <InventoryRankingChart
                            data={topProducts.slice(0, 10).map((p) => ({
                              name: p.name,
                              value: Math.round(p.consumed * 10) / 10,
                            }))}
                            valueLabel="Unidades"
                          />
                        </Card>

                        <Card>
                          <CardLabel>Top 10 por costo consumido</CardLabel>
                          <InventoryRankingChart
                            data={topProducts
                              .slice()
                              .sort((a, b) => b.cost - a.cost)
                              .slice(0, 10)
                              .map((p) => ({
                                name: p.name,
                                value: Math.round(p.cost),
                              }))}
                            valueLabel="Costo"
                            money
                          />
                        </Card>
                      </div>

                      <Card>
                        <CardLabel>Detalle de consumo</CardLabel>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[780px] text-sm">
                            <thead>
                              <tr className="border-b border-outline-variant text-left text-xs text-outline">
                                <th className="pb-2 font-medium">Producto</th>
                                <th className="pb-2 font-medium">Categoría</th>
                                <th className="pb-2 text-right font-medium">Consumido</th>
                                <th className="pb-2 text-right font-medium">Costo</th>
                                <th className="pb-2 text-right font-medium">Stock</th>
                                <th className="pb-2 text-right font-medium">Cobertura</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                              {topProducts.slice(0, 40).map((product) => (
                                <tr key={product.id}>
                                  <td className="py-3">
                                    <Link
                                      href={`/administration/inventory/products/${product.id}`}
                                      className="font-semibold text-on-surface hover:underline"
                                    >
                                      {product.name}
                                    </Link>
                                    <span className="block text-[10px] text-outline">
                                      {product.code}
                                    </span>
                                  </td>
                                  <td className="py-3 text-xs text-on-surface-variant">
                                    {product.category}
                                  </td>
                                  <td className="py-3 text-right font-bold text-on-surface">
                                    {units(product.consumed)}{" "}
                                    <span className="text-xs font-normal text-outline">
                                      {product.unit}
                                    </span>
                                  </td>
                                  <td className="py-3 text-right text-on-surface-variant">
                                    {money(product.cost)}
                                  </td>
                                  <td className="py-3 text-right text-on-surface-variant">
                                    {units(product.stock)}
                                  </td>
                                  <td className="py-3 text-right">
                                    {product.daysOfCover !== null ? (
                                      <span
                                        className={
                                          product.daysOfCover < 7
                                            ? "font-bold text-error"
                                            : product.daysOfCover < 14
                                              ? "font-bold text-secondary"
                                              : "text-on-surface-variant"
                                        }
                                      >
                                        {Math.round(product.daysOfCover)} días
                                      </span>
                                    ) : (
                                      <span className="text-outline">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <p className="mt-3 text-xs text-outline">
                          Cobertura = cuántos días alcanza el stock actual al ritmo de
                          consumo de este periodo. Menos de 7 días en rojo.
                        </p>
                      </Card>
                    </>
                  )}
                </div>
              ),
            },

            {
              key: "categorias",
              label: "Categorías",
              icon: <GridIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {categories.length === 0 ? (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        Sin movimientos en este periodo.
                      </p>
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <CardLabel>Costo consumido por categoría</CardLabel>
                          <InventoryShareChart
                            data={categories.map((c) => ({
                              name: c.name,
                              value: Math.round(c.cost),
                            }))}
                            money
                          />
                        </Card>

                        <Card>
                          <CardLabel>Unidades por categoría</CardLabel>
                          <InventoryRankingChart
                            data={categories.map((c) => ({
                              name: c.name,
                              value: Math.round(c.consumed * 10) / 10,
                            }))}
                            valueLabel="Unidades"
                          />
                        </Card>
                      </div>

                      <Card>
                        <CardLabel>Detalle por categoría</CardLabel>
                        <div className="mt-2 divide-y divide-outline-variant">
                          {categories.map((category) => {
                            const share =
                              totals.consumedCost > 0
                                ? Math.round((category.cost / totals.consumedCost) * 100)
                                : 0;

                            return (
                              <div
                                key={category.name}
                                className="flex items-center justify-between gap-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-on-surface">
                                    {category.name}
                                  </p>
                                  <p className="text-xs text-on-surface-variant">
                                    {category.products} productos ·{" "}
                                    {category.movements} movimientos · {share}% del costo
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  <p className="font-bold text-on-surface">
                                    {money(category.cost)}
                                  </p>
                                  <p className="text-xs text-on-surface-variant">
                                    {units(category.consumed)} unidades
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </>
                  )}
                </div>
              ),
            },

            {
              key: "sucursales",
              label: "Sucursales",
              icon: <StoreIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {branches.length === 0 ? (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        Sin movimientos en este periodo.
                      </p>
                    </Card>
                  ) : (
                    <>
                      <Card>
                        <CardLabel>Costo consumido por sucursal</CardLabel>
                        <InventoryRankingChart
                          data={branches.map((b) => ({
                            name: b.name,
                            value: Math.round(b.cost),
                          }))}
                          valueLabel="Costo"
                          money
                        />
                      </Card>

                      <Card>
                        <CardLabel>Detalle por sucursal</CardLabel>
                        <div className="mt-2 divide-y divide-outline-variant">
                          {branches.map((branch) => {
                            const share =
                              totals.consumedCost > 0
                                ? Math.round((branch.cost / totals.consumedCost) * 100)
                                : 0;

                            return (
                              <div
                                key={branch.id}
                                className="flex items-center justify-between gap-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-on-surface">
                                    {branch.name}
                                  </p>
                                  <p className="text-xs text-on-surface-variant">
                                    {branch.movements} movimientos · {share}% del consumo
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  <p className="font-bold text-on-surface">
                                    {money(branch.cost)}
                                  </p>
                                  <p className="text-xs text-on-surface-variant">
                                    {units(branch.consumed)} unidades
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </>
                  )}
                </div>
              ),
            },

            {
              key: "alertas",
              label: "Alertas",
              icon: <AlertIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardLabel>Bajo mínimo</CardLabel>
                      <p
                        className={`text-2xl font-bold ${
                          totals.lowStockCount > 0 ? "text-error" : "text-on-surface"
                        }`}
                      >
                        {totals.lowStockCount}
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Agotados</CardLabel>
                      <p
                        className={`text-2xl font-bold ${
                          totals.outOfStockCount > 0 ? "text-error" : "text-on-surface"
                        }`}
                      >
                        {totals.outOfStockCount}
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Sin movimiento</CardLabel>
                      <p
                        className={`text-2xl font-bold ${
                          totals.staleCount > 0 ? "text-secondary" : "text-on-surface"
                        }`}
                      >
                        {totals.staleCount}
                      </p>
                    </Card>
                  </div>

                  <Card>
                    <CardLabel>Por debajo de su existencia mínima</CardLabel>

                    {lowStock.length === 0 ? (
                      <p className="mt-3 text-sm text-on-surface-variant">
                        Ningún producto está por debajo de su mínimo.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead>
                            <tr className="border-b border-outline-variant text-left text-xs text-outline">
                              <th className="pb-2 font-medium">Producto</th>
                              <th className="pb-2 font-medium">Categoría</th>
                              <th className="pb-2 text-right font-medium">Stock</th>
                              <th className="pb-2 text-right font-medium">Mínimo</th>
                              <th className="pb-2 text-right font-medium">Cobertura</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {lowStock.map((product) => (
                              <tr key={product.id}>
                                <td className="py-3">
                                  <Link
                                    href={`/administration/inventory/products/${product.id}`}
                                    className="font-semibold text-on-surface hover:underline"
                                  >
                                    {product.name}
                                  </Link>
                                </td>
                                <td className="py-3 text-xs text-on-surface-variant">
                                  {product.category}
                                </td>
                                <td className="py-3 text-right font-bold text-error">
                                  {units(product.stock)} {product.unit}
                                </td>
                                <td className="py-3 text-right text-on-surface-variant">
                                  {units(product.minimumStock)}
                                </td>
                                <td className="py-3 text-right text-on-surface-variant">
                                  {product.daysOfCover !== null
                                    ? `${Math.round(product.daysOfCover)} días`
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  <Card>
                    <CardLabel>Inventario parado (más de 60 días sin movimiento)</CardLabel>

                    {stale.length === 0 ? (
                      <p className="mt-3 text-sm text-on-surface-variant">
                        Todo el inventario con existencia ha tenido movimiento reciente.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                          <thead>
                            <tr className="border-b border-outline-variant text-left text-xs text-outline">
                              <th className="pb-2 font-medium">Producto</th>
                              <th className="pb-2 font-medium">Categoría</th>
                              <th className="pb-2 text-right font-medium">Stock</th>
                              <th className="pb-2 text-right font-medium">
                                Último movimiento
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {stale.slice(0, 30).map((product) => (
                              <tr key={product.id}>
                                <td className="py-3">
                                  <Link
                                    href={`/administration/inventory/products/${product.id}`}
                                    className="font-semibold text-on-surface hover:underline"
                                  >
                                    {product.name}
                                  </Link>
                                </td>
                                <td className="py-3 text-xs text-on-surface-variant">
                                  {product.category}
                                </td>
                                <td className="py-3 text-right text-on-surface-variant">
                                  {units(product.stock)} {product.unit}
                                </td>
                                <td className="py-3 text-right text-xs text-on-surface-variant">
                                  {formatDate(product.lastMovement)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              ),
            },

            {
              key: "movimientos",
              label: "Movimientos",
              icon: <ChartLineIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {movementTypes.length === 0 ? (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        Sin movimientos en este periodo.
                      </p>
                    </Card>
                  ) : (
                    <>
                      <Card>
                        <CardLabel>Entradas y salidas por día</CardLabel>
                        <InventoryFlowChart data={daily} />
                      </Card>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <CardLabel>Reparto por tipo de movimiento</CardLabel>
                          <InventoryShareChart
                            data={movementTypes.map((t) => ({
                              name: t.name,
                              value: t.movements,
                            }))}
                          />
                        </Card>

                        <Card>
                          <CardLabel>Detalle por tipo</CardLabel>
                          <div className="mt-2 divide-y divide-outline-variant">
                            {movementTypes.map((type) => (
                              <div
                                key={type.name}
                                className="flex items-center justify-between gap-4 py-3"
                              >
                                <span className="text-on-surface-variant">
                                  {type.name}
                                </span>
                                <span className="text-right">
                                  <span className="block font-bold text-on-surface">
                                    {type.movements} movimientos
                                  </span>
                                  <span className="text-xs text-on-surface-variant">
                                    {units(type.units)} unidades
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
