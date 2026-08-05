import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookIcon } from "@/components/ui/icons";

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
          <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
            Elaboración de licores
          </p>

          <h1 className="mt-2 text-3xl font-black text-on-surface">
            Recetas
          </h1>

          <p className="mt-2 text-on-surface-variant">
            Crea, consulta y configura las fórmulas de cada licor.
          </p>
        </div>

        <Link
          href="/liquors/recipes/new"
          className="rounded-2xl bg-primary px-5 py-3 text-center font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
        >
          + Nueva receta
        </Link>
      </header>

      {recipes.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <BookIcon className="mx-auto h-12 w-12 text-on-surface-variant" />

          <h2 className="mt-5 text-2xl font-black text-on-surface">
            No hay recetas registradas
          </h2>

          <p className="mt-3 text-on-surface-variant">
            Crea la primera receta para comenzar a configurar sus
            ingredientes y procedimiento.
          </p>

          <Link
            href="/liquors/recipes/new"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
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
              className="group rounded-3xl border border-outline-variant bg-surface-container/70 p-6 transition hover:border-primary/25 hover:bg-surface-container"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-4xl">
                  {recipe.product.icon ?? "🍹"}
                </span>

                <span
                  className={
                    recipe.active
                      ? "rounded-full border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 px-3 py-1 text-xs font-black text-tertiary-fixed-dim"
                      : "rounded-full border border-outline-variant bg-surface-container-high px-3 py-1 text-xs font-black text-on-surface-variant"
                  }
                >
                  {recipe.active ? "Activa" : "Inactiva"}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-on-surface">
                {recipe.name}
              </h2>

              <p className="mt-2 text-sm font-semibold text-on-surface-variant">
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

              <p className="mt-6 font-black text-on-surface-variant transition group-hover:text-on-surface">
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
    <div className="rounded-2xl border border-outline-variant bg-background/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
        {label}
      </p>

      <p className="mt-1 font-black text-on-surface">
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