import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlusIcon, ChevronRightIcon } from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";

export default async function PosProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: selectedCategoryId } = await searchParams;

  const allCategories = await prisma.posCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      products: {
        orderBy: { position: "asc" },
        include: { variants: { orderBy: { position: "asc" } } },
      },
    },
  });

  const categories = selectedCategoryId
    ? allCategories.filter((c) => c.id === selectedCategoryId)
    : allCategories;

  const showGroupHeadings = !selectedCategoryId;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-end">
        <Link
          href="/pos/products/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo producto
        </Link>
      </div>

      {allCategories.length > 0 && (
        <div className="-mx-6 flex gap-1 overflow-x-auto border-b border-outline-variant px-6">
          <Link
            href="/pos/products"
            className={`shrink-0 border-b-2 px-3 pb-2.5 text-sm font-semibold transition ${
              !selectedCategoryId
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Todas
          </Link>
          {allCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/pos/products?category=${cat.id}`}
              className={`shrink-0 border-b-2 px-3 pb-2.5 text-sm font-semibold transition ${
                selectedCategoryId === cat.id
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {cat.name}
              <span className="ml-1.5 opacity-60">{cat.products.length}</span>
            </Link>
          ))}
        </div>
      )}

      {allCategories.length === 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            Primero crea una categoría.
          </p>
          <Link
            href="/pos/categories"
            className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Ir a categorías
          </Link>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat.id}>
          {showGroupHeadings && (
            <h2 className="mb-3 text-sm font-semibold uppercase text-on-surface-variant">
              {cat.name}
            </h2>
          )}

          <div className="mb-4 space-y-2">
            {cat.products.map((product) => {
              const visual = getProductVisual(product.icon);
              return (
              <Link key={product.id} href={`/pos/products/${product.id}`}>
                <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container/60 p-4 transition hover:border-primary/40">
                  {visual.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={visual.url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white/90"
                      style={{ backgroundColor: visual.hex }}
                    >
                      {product.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        product.active ? "text-on-surface" : "text-outline"
                      }`}
                    >
                      {product.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {product.variants.length} variante
                      {product.variants.length === 1 ? "" : "s"} ·{" "}
                      {product.variants
                        .map((v) => `${v.name} $${v.price.toFixed(2)}`)
                        .join(", ")}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-on-surface-variant" />
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
