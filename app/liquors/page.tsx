import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookIcon, MartiniIcon } from "@/components/ui/icons";

export default async function LiquorsHomePage() {
  const products = await prisma.liquorProduct.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
    include: {
      recipes: {
        where: {
          active: true,
        },
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          batches: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
            Elaboración de licores
          </p>

          <h1 className="mt-2 text-3xl font-black text-on-surface sm:text-4xl">
            Catálogo de productos
          </h1>

          <p className="mt-2 text-on-surface-variant">
            Elige un producto para consultar su receta, iniciar una nueva
            elaboración o revisar su historial de lotes.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/liquors/recipes"
            className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant px-5 py-3 text-center font-black text-on-surface transition duration-150 ease-out hover:border-primary/25 hover:scale-[1.04] active:scale-[0.97]"
          >
            <BookIcon className="h-4 w-4" />
            Ver recetas
          </Link>

          <Link
            href="/liquors/products/new"
            className="rounded-2xl bg-primary px-5 py-3 text-center font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
          >
            + Nuevo producto
          </Link>
        </div>
      </header>

      {products.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <MartiniIcon className="mx-auto h-12 w-12 text-on-surface-variant" />

          <h2 className="mt-5 text-2xl font-black text-on-surface">
            No hay productos registrados
          </h2>

          <p className="mx-auto mt-3 max-w-md text-on-surface-variant">
            Registra tu primer producto para comenzar a elaborar recetas y
            lotes.
          </p>

          <Link
            href="/liquors/products/new"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
          >
            + Nuevo producto
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const hasRecipe = product.recipes.length > 0;

            return (
              <Link
                key={product.id}
                href={`/liquors/products/${product.slug}`}
                className="rounded-3xl border border-outline-variant bg-surface-container/70 p-6 transition hover:border-primary/25 hover:bg-surface-container"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-4xl">{product.icon ?? "🍹"}</span>

                  <span
                    className={
                      hasRecipe
                        ? "rounded-full border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 px-3 py-1 text-xs font-black text-tertiary-fixed-dim"
                        : "rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-black text-secondary"
                    }
                  >
                    {hasRecipe ? "Con receta" : "Sin receta"}
                  </span>
                </div>

                <h2 className="mt-5 text-xl font-black text-on-surface">
                  {product.name}
                </h2>

                {product.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                    {product.description}
                  </p>
                )}

                <p className="mt-5 text-sm text-outline">
                  {product._count.batches}{" "}
                  {product._count.batches === 1
                    ? "lote elaborado"
                    : "lotes elaborados"}
                </p>

                <p className="mt-3 font-black text-on-surface-variant">
                  Ver producto →
                </p>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
