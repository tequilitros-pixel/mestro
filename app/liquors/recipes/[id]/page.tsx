import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecipeIngredientsEditor from "@/components/liquors/RecipeIngredientsEditor";
import RecipeStepsEditor from "../../RecipeStepsEditor";

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
          rawMaterial: {
            select: {
              id: true,
              name: true,
              baseUnit: true,
            },
          },
        },
      },
      steps: {
        orderBy: {
          position: "asc",
        },
        include: {
          recipeIngredient: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unit: true,
              position: true,
              rawMaterial: {
                select: {
                  id: true,
                  name: true,
                  baseUnit: true,
                },
              },
            },
          },
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

  const ingredientsForSteps = recipe.ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    position: ingredient.position,
    rawMaterial: ingredient.rawMaterial
      ? {
          id: ingredient.rawMaterial.id,
          name: ingredient.rawMaterial.name,
          unit: ingredient.rawMaterial.baseUnit,
        }
      : null,
  }));

  const stepsForEditor = recipe.steps.map((step) => ({
    id: step.id,
    position: step.position,
    type: step.type,
    title: step.title,
    instruction: step.instruction,
    actions: step.actions,
    checks: step.checks,
    recipeIngredientId: step.recipeIngredientId,
    durationMinutes: step.durationMinutes,
    measurementLabel: step.measurementLabel,
    measurementUnit: step.measurementUnit,
    minimumValue: step.minimumValue,
    maximumValue: step.maximumValue,
    required: step.required,
    active: step.active,
    recipeIngredient: step.recipeIngredient
      ? {
          id: step.recipeIngredient.id,
          name: step.recipeIngredient.name,
          quantity: step.recipeIngredient.quantity,
          unit: step.recipeIngredient.unit,
          position: step.recipeIngredient.position,
          rawMaterial: step.recipeIngredient.rawMaterial
            ? {
                id: step.recipeIngredient.rawMaterial.id,
                name: step.recipeIngredient.rawMaterial.name,
                unit: step.recipeIngredient.rawMaterial.baseUnit,
              }
            : null,
        }
      : null,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/liquors/recipes"
        className="text-sm font-bold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Volver a recetas
      </Link>

      <header className="mt-6 rounded-3xl border border-outline-variant bg-surface-container/70 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
              {recipe.product.icon ?? "🍹"} {recipe.product.name}
            </p>

            <h1 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">
              {recipe.name}
            </h1>

            <p className="mt-3 text-on-surface-variant">
              Versión {recipe.version}
            </p>
          </div>

          <span
            className={
              recipe.active
                ? "w-fit rounded-full border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 px-4 py-2 text-sm font-black text-tertiary-fixed-dim"
                : "w-fit rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 text-sm font-black text-on-surface-variant"
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

          <Metric
            label="Pasos"
            value={String(recipe.steps.length)}
          />
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

      <div className="mt-8">
        <RecipeStepsEditor
          recipeId={recipe.id}
          steps={stepsForEditor}
          ingredients={ingredientsForSteps}
        />
      </div>
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
    <div className="rounded-2xl border border-outline-variant bg-background/50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-outline">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-on-surface">
        {value}
      </p>
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
    <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
      <p className="text-xs font-black uppercase tracking-wider text-outline">
        {title}
      </p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
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