import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlusIcon, ChevronRightIcon } from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";

export default async function PosProductsPage() {
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">
            Productos del catálogo
          </h1>
          <p className="text-sm text-on-surface-variant">
            Variantes, precios y recetas de ingredientes.
          </p>
        </div>

        <Link
          href="/pos/products/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo producto
        </Link>
      </div>

      {categories.length === 0 && (
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
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-on-surface-variant">
            {cat.name}
            {!cat.active && (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                Inactiva
              </span>
            )}
          </h2>

          {cat.products.length === 0 && (
            <p className="mb-4 text-sm text-on-surface-variant">
              Sin productos en esta categoría.
            </p>
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
