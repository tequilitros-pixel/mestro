import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function LiquorRecipesPage() {
  const recipes = await prisma.liquorRecipe.findMany({
    orderBy: [
      {
        active: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    include: {
      product: true,
      _count: {
        select: {
          ingredients: true,
          steps: true,
        },
      },
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
            Crea, consulta y configura las fórmulas de cada licor.
          </p>
        </div>

        <Link
          href="/liquors/recipes/new"
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
            Crea la primera receta para comenzar a configurar sus
            ingredientes y procedimiento.
          </p>

          <Link
            href="/liquors/recipes/new"
            className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-black text-white transition hover:bg-purple-500"
          >
            + Crear primera receta
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/liquors/recipes/${recipe.id}`}
              className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-purple-500/40 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-4xl">
                  {recipe.product.icon ?? "🍹"}
                </span>

                <span
                  className={
                    recipe.active
                      ? "rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-black text-green-300"
                      : "rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-black text-slate-400"
                  }
                >
                  {recipe.active ? "Activa" : "Inactiva"}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-white">
                {recipe.name}
              </h2>

              <p className="mt-2 text-sm font-semibold text-purple-300">
                {recipe.product.name} · Versión {recipe.version}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric
                  label="Volumen base"
                  value={
                    recipe.targetLiters !== null
                      ? `${formatNumber(recipe.targetLiters)} L`
                      : "Sin definir"
                  }
                />

                <Metric
                  label="Alcohol"
                  value={
                    recipe.targetAlcohol !== null
                      ? `${formatNumber(recipe.targetAlcohol)}%`
                      : "Sin definir"
                  }
                />

                <Metric
                  label="Ingredientes"
                  value={String(recipe._count.ingredients)}
                />

                <Metric
                  label="Pasos"
                  value={String(recipe._count.steps)}
                />
              </div>

              <p className="mt-6 font-black text-purple-200 transition group-hover:text-purple-100">
                Configurar receta →
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-black text-white">
        {value}
      </p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}