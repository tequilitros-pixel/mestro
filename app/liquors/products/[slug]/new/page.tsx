import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorRecipeCalculator from "@/components/liquors/LiquorRecipeCalculator";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function NewLiquorBatchPage({
  params,
}: Props) {
  const { slug } = await params;

  const product = await prisma.liquorProduct.findUnique({
    where: {
      slug,
    },
    include: {
      recipes: {
        where: {
          active: true,
        },
        include: {
          ingredients: {
            orderBy: {
              position: "asc",
            },
          },
        },
        orderBy: {
          version: "desc",
        },
        take: 1,
      },
    },
  });

  if (!product) {
    notFound();
  }

  const recipe = product.recipes[0];

  if (!recipe || recipe.targetLiters === null) {
    return (
      <section className="mx-auto max-w-4xl">
        <Link
          href={`/liquors/products/${product.slug}`}
          className="text-sm font-semibold text-purple-300 hover:text-purple-200"
        >
          ← Regresar a {product.name}
        </Link>

        <div className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-8">
          <h1 className="text-3xl font-black text-white">
            No hay receta disponible
          </h1>

          <p className="mt-3 text-amber-100/80">
            Este producto necesita una receta activa con volumen base antes de
            generar una orden de producción.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl">
      <Link
        href={`/liquors/products/${product.slug}`}
        className="text-sm font-semibold text-purple-300 hover:text-purple-200"
      >
        ← Regresar a {product.name}
      </Link>

      <header className="mt-6 mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-purple-400">
          Maestro Licorero
        </p>

        <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
          Elaborar {product.name}
        </h1>

        <p className="mt-4 max-w-3xl text-slate-400">
          Escribe el volumen deseado. MAESTRO calculará la receta oficial en
          tiempo real.
        </p>
      </header>

      <LiquorRecipeCalculator
      productId={product.id}
recipeId={recipe.id}
        productName={product.name}
        productIcon={product.icon}
        recipeName={recipe.name}
        recipeVersion={recipe.version}
        targetLiters={recipe.targetLiters}
        targetAlcohol={recipe.targetAlcohol}
        ingredients={recipe.ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
          optional: ingredient.optional,
        }))}
      />
    </section>
  );
}