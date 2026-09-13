import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ChevronRightIcon } from "@/components/ui/icons";
import CategoryManager from "@/components/pos/CategoryManager";

export default async function PosCategoriesPage() {
  const categories = await prisma.posCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      products: {
        orderBy: { position: "asc" },
        include: { variants: { orderBy: { position: "asc" } } },
      },
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">
            Categorías del catálogo
          </h1>
          <p className="text-sm text-on-surface-variant">
            Organiza los productos del punto de venta.
          </p>
        </div>

        <Link
          href="/pos/products"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
        >
          Ver productos
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active,
          products: c.products.map((p) => ({
            id: p.id,
            name: p.name,
            active: p.active,
            icon: p.icon,
            variants: p.variants.map((v) => ({ name: v.name, price: v.price })),
          })),
        }))}
      />
    </div>
  );
}
