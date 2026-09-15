import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStockMatrix } from "../../lib/stock";
import { getAccessibleBranchIds } from "@/lib/auth";
import {
  formatCommercialPresentation,
  formatCommercialQuantity,
  hasValidCommercialConversion,
} from "@/lib/inventory/units";
import {
  classifyStock,
  resolveStockBranchSelection,
} from "@/lib/inventory/stockSelection";

type StockProduct = {
  name: string;
  unit: string;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: unknown;
  contentUnit: string | null;
  normalizedContentPerUnit: unknown;
};

function formatStock(quantity: number, product: StockProduct) {
  return formatCommercialQuantity(quantity, product);
}

function commercialLabel(product: StockProduct) {
  const config = { ...product, productName: product.name };
  return hasValidCommercialConversion(config)
    ? formatCommercialPresentation(config) ?? "Presentación por configurar"
    : "Presentación por configurar";
}

type StockSearchParams = {
  branchId?: string | string[];
  q?: string | string[];
};

function singleSearchParam(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  return value === undefined ? undefined : "__multiple_values__";
}

export default async function BranchStockPage({
  searchParams,
}: {
  searchParams?: Promise<StockSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const allowedBranchIds = await getAccessibleBranchIds();
  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selection = resolveStockBranchSelection(
    branches,
    singleSearchParam(params.branchId),
  );

  if (selection.rejected) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Link
            href="/administration/inventory/sucursales"
            className="inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Inventario de sucursales
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">Stock actual</h1>
          <p role="alert" className="rounded-2xl border border-error/40 bg-error/10 p-5 text-sm text-error">
            La ubicación seleccionada no existe o no está autorizada.
          </p>
        </div>
      </main>
    );
  }

  const selectedBranch = selection.branch;
  const products = await prisma.inventoryProduct.findMany({
    where: { isActive: true, archivedAt: null, trackStock: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      category: true,
      minimumStock: true,
      inventoryBaseUnit: true,
      handlingUnit: true,
      contentPerUnit: true,
      contentUnit: true,
      normalizedContentPerUnit: true,
    },
  });

  const search = singleSearchParam(params.q)?.trim().toLowerCase() ?? "";
  const visibleProducts = products.filter((product) =>
    !search || `${product.name} ${product.category} ${product.unit}`.toLowerCase().includes(search),
  );

  const matrix = selectedBranch
    ? await computeStockMatrix(
        visibleProducts.map((product) => product.id),
        [selectedBranch.id],
      )
    : null;
  const branchStock = selectedBranch && matrix
    ? matrix.stockByBranch.get(selectedBranch.id)
    : undefined;

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
          <h1 className="text-3xl font-bold sm:text-4xl">
            Stock actual{selectedBranch ? ` · ${selectedBranch.name}` : ""}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Existencia calculada desde el ledger POS2. Los productos aún no inicializados
            conservan una lectura temporal de su historial anterior para no perder stock real.
          </p>
        </div>

        <form
          method="get"
          className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end"
        >
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-on-surface-variant">
              Sucursal / ubicación
            </span>
            <select
              name="branchId"
              defaultValue={selectedBranch?.id ?? ""}
              className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm text-on-surface"
            >
              {branches.length === 0 && <option value="">Sin ubicaciones autorizadas</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-on-surface-variant">Buscar</span>
            <input
              name="q"
              defaultValue={singleSearchParam(params.q) ?? ""}
              placeholder="Producto, categoría o unidad"
              className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm text-on-surface"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            Ver stock
          </button>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="sticky left-0 bg-surface-container px-4 py-3">Producto</th>
                <th className="px-4 py-3">Presentación</th>
                <th className="px-4 py-3 text-right">Existencia</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {(!selectedBranch || visibleProducts.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">
                    {!selectedBranch
                      ? "No tienes ubicaciones autorizadas."
                      : "No hay productos que coincidan con la búsqueda."}
                  </td>
                </tr>
              )}
              {visibleProducts.map((product) => {
                const stock = branchStock?.get(product.id) ?? 0;
                const minimum = Number(product.minimumStock);
                const alert = classifyStock(stock, minimum);
                const isNegative = alert === "NEGATIVE";
                const isLow = alert === "LOW";

                return (
                  <tr
                    key={product.id}
                    className={`border-t border-outline-variant last:border-0 ${
                      isNegative || isLow ? "bg-error/5" : ""
                    }`}
                  >
                    <td className="sticky left-0 bg-surface-container px-4 py-3 font-medium text-on-surface">
                      {product.name}
                      <span className="ml-2 text-xs text-on-surface-variant">{product.category}</span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {commercialLabel(product)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        isNegative || isLow ? "text-error" : "text-on-surface"
                      }`}
                    >
                      {formatStock(stock, product)}
                      {isNegative && (
                        <span className="ml-2 text-xs font-bold" role="status">
                          ALERTA
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {minimum > 0 ? formatStock(minimum, product) : "—"}
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
