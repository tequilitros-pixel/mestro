import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStockMatrix } from "../../lib/stock";

const numberFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
const literFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

function formatStock(quantity: number, unit: string) {
  if (unit.trim().toLowerCase() === "ml") {
    return `${literFormat.format(quantity / 1000)} L (${numberFormat.format(quantity)} ml)`;
  }

  return `${numberFormat.format(quantity)} ${unit}`;
}

export default async function BranchStockPage() {
  const products = await prisma.inventoryProduct.findMany({
    where: { isActive: true, trackStock: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, category: true, minimumStock: true },
  });

  const matrix = await computeStockMatrix(products.map((p) => p.id));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            href="/administration/inventory/sucursales"
            className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Inventario de sucursales
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">Stock actual</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Estimado a partir del último conteo cerrado de cada sucursal más las
            movimientos y ajustes registrados desde entonces.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="sticky left-0 bg-surface-container px-4 py-3">Producto</th>
                {matrix.branches.map((branch) => (
                  <th key={branch.id} className="px-4 py-3 text-right">
                    {branch.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={matrix.branches.length + 3}
                    className="px-4 py-6 text-center text-on-surface-variant"
                  >
                    No hay productos con seguimiento de stock.
                  </td>
                </tr>
              )}
              {products.map((product) => {
                const total = matrix.branches.reduce(
                  (sum, branch) => sum + (matrix.stockByBranch.get(branch.id)?.get(product.id) ?? 0),
                  0,
                );
                const minimum = Number(product.minimumStock);
                const isLow = minimum > 0 && total < minimum;

                return (
                  <tr
                    key={product.id}
                    className={`border-t border-outline-variant last:border-0 ${
                      isLow ? "bg-error/5" : ""
                    }`}
                  >
                    <td className="sticky left-0 bg-surface-container px-4 py-3 font-medium text-on-surface">
                      {product.name}
                      {product.unit.trim().toLowerCase() !== "ml" && (
                        <span className="ml-2 text-xs text-on-surface-variant">{product.unit}</span>
                      )}
                    </td>
                    {matrix.branches.map((branch) => {
                      const stock = matrix.stockByBranch.get(branch.id)?.get(product.id) ?? 0;
                      return (
                        <td key={branch.id} className="px-4 py-3 text-right text-on-surface-variant">
                          {formatStock(stock, product.unit)}
                        </td>
                      );
                    })}
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        isLow ? "text-error" : "text-on-surface"
                      }`}
                    >
                      {formatStock(total, product.unit)}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {minimum > 0 ? formatStock(minimum, product.unit) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
