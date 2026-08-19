import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewProductModal from "./NewProductModal";
import ProductsList from "./ProductsList";

export default async function InventoryProductsPage() {
  const products = await prisma.inventoryProduct.findMany({
      orderBy: { name: "asc" },
  });

  const productsForList = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    unit: p.unit,
    unitCost: p.unitCost !== null ? Number(p.unitCost) : null,
    itemType: p.itemType,
    isActive: p.isActive,
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Inventario
            </p>

            <h1 className="text-3xl font-bold sm:text-4xl">Productos</h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
              Registra bebidas, insumos, herramientas y equipo para sucursales
              y eventos.
            </p>
          </div>

          <div className="flex w-fit shrink-0 items-center gap-3">
            <Link
              href="/administration/inventory"
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:border-primary/25 hover:text-on-surface active:scale-[0.97]"
            >
              ← Regresar a Inventario
            </Link>

            <NewProductModal />
          </div>
        </div>

        <ProductsList products={productsForList} />
      </div>
    </main>
  );
}
