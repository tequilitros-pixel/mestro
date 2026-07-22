import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function LiquorRecipesPage() {
  const recipes = await prisma.liquorRecipe.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
            Elaboración de licores
          </p>

          <h1 className="mt-2 text-3xl font-black text-white">
            Recetas
          </h1>

          <p className="mt-2 text-slate-400">
            Consulta las fórmulas registradas para cada producto.
          </p>
        </div>

        <Link
          href="/liquors"
          className="rounded-2xl bg-purple-600 px-5 py-3 text-center font-black text-white transition hover:bg-purple-500"
        >
          + Nueva receta
        </Link>
      </header>

      {recipes.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <div className="text-5xl">📖</div>

          <h2 className="mt-5 text-2xl font-black text-white">
            No hay recetas registradas
          </h2>

          <p className="mt-3 text-slate-400">
            Las recetas creadas aparecerán en esta sección.
          </p>

          <Link
            href="/liquors"
            className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-black text-white transition hover:bg-purple-500"
          >
            Ir al inicio de licores
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/liquors/products/${recipe.product.slug}`}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-purple-500/40 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-4xl">
                  {recipe.product.icon ?? "🍹"}
                </span>

                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-black text-purple-300">
                  {recipe.targetAlcohol}% Alc.
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-white">
                {recipe.name}
              </h2>

              <p className="mt-2 text-sm font-semibold text-purple-300">
                {recipe.product.name}
              </p>

              <p className="mt-5 font-black text-white">
                Ver producto y receta →
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}