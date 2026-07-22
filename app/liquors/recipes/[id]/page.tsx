import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecipeIngredientsEditor from "@/components/liquors/RecipeIngredientsEditor";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LiquorRecipeDetailPage({
  params,
}: Props) {
  const { id } = await params;

  const recipe = await prisma.liquorRecipe.findUnique({
    where: {
      id,
    },
    include: {
      product: true,
      ingredients: {
        orderBy: {
          position: "asc",
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          position: true,
          optional: true,
          notes: true,
          rawMaterialId: true,
        },
      },
      steps: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!recipe) {
    notFound();
  }

  const rawMaterials = await prisma.rawMaterial.findMany({
    where: {
      active: true,
    },
    orderBy: [
      {
        category: "asc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      name: true,
      code: true,
      baseUnit: true,
      category: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/liquors/recipes"
        className="text-sm font-bold text-purple-300 transition hover:text-purple-200"
      >
        ← Volver a recetas
      </Link>

      <header className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
              {recipe.product.icon ?? "🍹"} {recipe.product.name}
            </p>

            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              {recipe.name}
            </h1>

            <p className="mt-3 text-slate-400">
              Versión {recipe.version}
            </p>
          </div>

          <span
            className={
              recipe.active
                ? "w-fit rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-black text-green-300"
                : "w-fit rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-black text-slate-400"
            }
          >
            {recipe.active ? "Receta activa" : "Receta inactiva"}
          </span>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Volumen base"
            value={
              recipe.targetLiters !== null
                ? `${formatNumber(recipe.targetLiters)} L`
                : "Sin definir"
            }
          />

          <Metric
            label="Alcohol objetivo"
            value={
              recipe.targetAlcohol !== null
                ? `${formatNumber(recipe.targetAlcohol)}%`
                : "Sin definir"
            }
          />

          <Metric
            label="Ingredientes"
            value={String(recipe.ingredients.length)}
          />

          <Metric label="Pasos" value={String(recipe.steps.length)} />
        </div>

        {(recipe.instructions || recipe.notes) && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {recipe.instructions && (
              <InformationCard
                title="Instrucciones generales"
                value={recipe.instructions}
              />
            )}

            {recipe.notes && (
              <InformationCard
                title="Notas de la receta"
                value={recipe.notes}
              />
            )}
          </div>
        )}
      </header>

      <div className="mt-8">
        <RecipeIngredientsEditor
          recipeId={recipe.id}
          ingredients={recipe.ingredients}
          rawMaterials={rawMaterials}
        />
      </div>

      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
              Procedimiento
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              📋 Constructor de pasos
            </h2>

            <p className="mt-3 max-w-2xl text-slate-400">
              Aquí configuraremos el orden de elaboración, las
              instrucciones, mediciones, tiempos y controles de
              calidad de la receta.
            </p>
          </div>

          <span className="w-fit rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-bold text-slate-500">
            Próximo módulo
          </span>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-center">
          <div className="text-4xl">🧠</div>

          <h3 className="mt-4 text-lg font-black text-white">
            Procedimiento inteligente
          </h3>

          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Después de registrar los ingredientes construiremos el
            editor de pasos que utilizará el asistente de producción.
          </p>
        </div>
      </section>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function InformationCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
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