import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/pos/ProductForm";
import { ChevronLeftIcon } from "@/components/ui/icons";

export default async function NewPosProductPage() {
  const [categories, inventoryProducts] = await Promise.all([
    prisma.posCategory.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, unit: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/pos/products"
          className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Productos
        </Link>
        <h1 className="text-2xl font-bold text-on-surface">Nuevo producto</h1>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            Primero crea al menos una categoría activa.
          </p>
          <Link
            href="/pos/categories"
            className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Ir a categorías
          </Link>
        </div>
      ) : (
        <ProductForm categories={categories} inventoryProducts={inventoryProducts} />
      )}
    </div>
  );
}
