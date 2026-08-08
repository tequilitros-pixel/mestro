import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStockMatrix, totalStockByProduct } from "../lib/stock";
import InventoryTrendChart from "../InventoryTrendChart";
import {
  ClipboardIcon,
  AlertIcon,
  PlusIcon,
  ChartLineIcon,
} from "@/components/ui/icons";
import PageTabs from "@/components/ui/PageTabs";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(
    value
  );

const entryTypeLabels: Record<string, string> = {
  COMPRA: "Compra",
  TRASPASO: "Traspaso",
  AJUSTE: "Ajuste",
};

const quickActions = [
  { label: "Nueva entrada", href: "/administration/inventory/branch-entries" },
  {
    label: "Nuevo traspaso",
    href: "/administration/inventory/sucursales/traspasos",
  },
  {
    label: "Nuevo conteo",
    href: "/administration/inventory/branch-counts/new",
  },
];

export default async function SucursalesInventoryPage() {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [products, recentEntries, entriesForTrend] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { isActive: true, trackStock: true },
      select: { id: true, name: true, unit: true, minimumStock: true },
    }),
    prisma.inventoryEntry.findMany({
      orderBy: { entryDate: "desc" },
      take: 12,
      include: { product: true, branch: true },
    }),
    prisma.inventoryEntry.findMany({
      where: { entryDate: { gte: fourteenDaysAgo } },
      select: { entryDate: true },
    }),
  ]);

  const matrix = await computeStockMatrix(products.map((p) => p.id));

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
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    trendMap.set(day.toISOString().slice(0, 10), 0);
  }
  for (const entry of entriesForTrend) {
    const key = new Date(entry.entryDate).toISOString().slice(0, 10);
    if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  }
  const trendData = Array.from(trendMap.entries()).map(([key, count]) => ({
    date: new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
    }).format(new Date(`${key}T00:00:00`)),
    label: new Intl.DateTimeFormat("es-MX", { day: "2-digit" }).format(
      new Date(`${key}T00:00:00`)
    ),
    movimientos: count,
  }));

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
              Stock por sucursal, entradas, traspasos y conteos semanales.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
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
