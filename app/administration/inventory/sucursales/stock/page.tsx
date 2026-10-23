import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStockMatrix } from "../../lib/stock";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { resolveStockBranchSelection } from "@/lib/inventory/stockSelection";
import BranchStockMinimumsClient, { type BranchStockMinimumRow } from "./BranchStockMinimumsClient";

type StockSearchParams = {
  branchId?: string | string[];
  category?: string | string[];
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
          <Link href="/administration/inventory/sucursales" className="inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface">
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
      inventoryBaseUnit: true,
      handlingUnit: true,
      contentPerUnit: true,
      contentUnit: true,
      normalizedContentPerUnit: true,
    },
  });

  const categories = Array.from(new Set(
    products.map((product) => product.category.trim()).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, "es-MX"));
  const requestedCategory = singleSearchParam(params.category)?.trim() ?? "";
  const selectedCategory = categories.includes(requestedCategory) ? requestedCategory : "";
  const search = singleSearchParam(params.q)?.trim().toLowerCase() ?? "";
  const visibleProducts = products.filter((product) =>
    (!selectedCategory || product.category === selectedCategory) &&
    (!search || `${product.name} ${product.category} ${product.unit}`.toLowerCase().includes(search)),
  );
  const visibleProductIds = visibleProducts.map((product) => product.id);

  const [matrix, configuredMinimums, user] = await Promise.all([
    selectedBranch
      ? computeStockMatrix(visibleProductIds, [selectedBranch.id])
      : Promise.resolve(null),
    selectedBranch
      ? prisma.branchInventoryMinimum.findMany({
          where: {
            branchId: selectedBranch.id,
            inventoryProductId: { in: visibleProductIds },
          },
          select: { inventoryProductId: true, minimumQuantity: true },
        })
      : Promise.resolve([]),
    getCurrentUser(),
  ]);

  const minimumByProduct = new Map(
    configuredMinimums.map((minimum) => [minimum.inventoryProductId, Number(minimum.minimumQuantity)]),
  );
  const branchStock = selectedBranch && matrix
    ? matrix.stockByBranch.get(selectedBranch.id)
    : undefined;
  const rows: BranchStockMinimumRow[] = visibleProducts.map((product) => ({
    ...product,
    contentPerUnit: product.contentPerUnit === null ? null : Number(product.contentPerUnit),
    normalizedContentPerUnit: product.normalizedContentPerUnit === null ? null : Number(product.normalizedContentPerUnit),
    stock: branchStock?.get(product.id) ?? 0,
    minimumQuantity: minimumByProduct.get(product.id) ?? 0,
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link href="/administration/inventory/sucursales" className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface">
            ← Inventario de sucursales
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Stock actual{selectedBranch ? ` · ${selectedBranch.name}` : ""}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Define el mínimo operativo de cada producto para esta sucursal y obtén una lista clara de lo que falta surtir. Los mínimos son independientes entre sucursales.
          </p>
        </div>

        <form method="get" className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-on-surface-variant">Sucursal / ubicación</span>
            <select name="branchId" defaultValue={selectedBranch?.id ?? ""} className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm text-on-surface">
              {branches.length === 0 && <option value="">Sin ubicaciones autorizadas</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-on-surface-variant">Categoría</span>
            <select name="category" defaultValue={selectedCategory} className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm text-on-surface">
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-on-surface-variant">Buscar</span>
            <input name="q" defaultValue={singleSearchParam(params.q) ?? ""} placeholder="Producto, categoría o unidad" className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm text-on-surface" />
          </label>
          <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">Ver stock</button>
        </form>

        {selectedBranch ? (
          <BranchStockMinimumsClient
            branchId={selectedBranch.id}
            branchName={selectedBranch.name}
            rows={rows}
            canEdit={user?.role === "ADMIN"}
          />
        ) : (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant">
            No tienes ubicaciones autorizadas.
          </div>
        )}
      </div>
    </main>
  );
}
