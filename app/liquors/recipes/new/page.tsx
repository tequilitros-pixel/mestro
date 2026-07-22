import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LiquorRecipeForm from "@/components/liquors/LiquorRecipeForm";

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
          className="text-sm font-bold text-purple-300 transition hover:text-purple-200"
        >
          ← Volver a recetas
        </Link>

        <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Constructor de recetas
        </p>

        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Nueva receta
        </h1>

        <p className="mt-3 max-w-2xl text-slate-400">
          Registra la información general de la fórmula. Después
          podrás agregar sus ingredientes y construir el
          procedimiento paso por paso.
        </p>
      </header>

      <section className="mt-8">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <div className="text-5xl">⚠️</div>

            <h2 className="mt-5 text-2xl font-black text-white">
              No hay productos disponibles
            </h2>

            <p className="mt-3 text-slate-300">
              Primero debes registrar o activar un producto de
              licores.
            </p>

            <Link
              href="/liquors"
              className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-black text-white"
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