import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LiquorRecipeForm from "@/components/liquors/LiquorRecipeForm";
import { AlertIcon } from "@/components/ui/icons";

export default async function NewLiquorRecipePage() {
  const products = await prisma.liquorProduct.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      icon: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header>
        <Link
          href="/liquors/recipes"
          className="text-sm font-bold text-on-surface-variant transition hover:text-on-surface"
        >
          ← Volver a recetas
        </Link>

        <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Constructor de recetas
        </p>

        <h1 className="mt-2 text-3xl font-black text-on-surface sm:text-4xl">
          Nueva receta
        </h1>

        <p className="mt-3 max-w-2xl text-on-surface-variant">
          Registra la información general de la fórmula. Después
          podrás agregar sus ingredientes y construir el
          procedimiento paso por paso.
        </p>
      </header>

      <section className="mt-8">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-secondary/30 bg-secondary/10 p-8 text-center">
            <AlertIcon className="mx-auto h-12 w-12 text-secondary" />

            <h2 className="mt-5 text-2xl font-black text-on-surface">
              No hay productos disponibles
            </h2>

            <p className="mt-3 text-on-surface-variant">
              Primero debes registrar o activar un producto de
              licores.
            </p>

            <Link
              href="/liquors"
              className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
            >
              Volver a licores
            </Link>
          </div>
        ) : (
          <LiquorRecipeForm products={products} />
        )}
      </section>
    </main>
  );
}