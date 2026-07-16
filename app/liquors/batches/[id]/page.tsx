import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorBatchAssistant from "@/components/liquors/LiquorBatchAssistant";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LiquorBatchPage({ params }: Props) {
  const { id } = await params;

  const batch = await prisma.liquorBatch.findUnique({
    where: {
      id,
    },
    include: {
      product: true,
      recipe: true,
      createdBy: true,
      executionIngredients: {
        orderBy: {
          createdAt: "asc",
        },
      },
      events: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!batch) {
    notFound();
  }

  const completedIngredients = batch.executionIngredients.filter(
    (ingredient) => ingredient.completed
  ).length;

  const totalIngredients = batch.executionIngredients.length;

  const progress =
    totalIngredients > 0
      ? Math.round((completedIngredients / totalIngredients) * 100)
      : 0;

  return (
    <section className="mx-auto max-w-6xl">
      <Link
        href={`/liquors/products/${batch.product.slug}`}
        className="text-sm font-semibold text-purple-300 transition hover:text-purple-200"
      >
        ← Regresar a {batch.product.name}
      </Link>

      <header className="mt-6 rounded-3xl border border-purple-500/20 bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-purple-400">
              Orden de elaboración
            </p>

            <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
              {batch.product.icon ?? "🍹"} {batch.code}
            </h1>

            <p className="mt-3 text-slate-400">
              {batch.product.name} · {batch.recipe.name} · Versión{" "}
              {batch.recipe.version}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-purple-300/70">
              Volumen objetivo
            </p>

            <p className="mt-1 text-3xl font-black text-purple-200">
              {formatNumber(batch.plannedLiters)} L
            </p>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Estado"
          value={formatStatus(batch.status)}
          detail="Etapa actual del lote"
        />

        <Kpi
          title="Alcohol objetivo"
          value={
            batch.initialAlcohol !== null
              ? `${formatNumber(batch.initialAlcohol)}%`
              : "No definido"
          }
          detail="Graduación esperada"
        />

        <Kpi
          title="Responsable"
          value={batch.createdBy.name}
          detail="Usuario que creó el lote"
        />

        <Kpi
          title="Avance"
          value={`${progress}%`}
          detail={`${completedIngredients} de ${totalIngredients} ingredientes`}
        />
      </section>
<LiquorBatchAssistant
  batchId={batch.id}
  ingredients={batch.executionIngredients.map(
    (ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      scaledQuantity: ingredient.scaledQuantity,
      actualQuantity: ingredient.actualQuantity,
      unit: ingredient.unit,
      completed: ingredient.completed,
      notes: ingredient.notes,
    })
  )}
/>
      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
              Ingredientes
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Orden calculada
            </h2>
          </div>

          <p className="text-sm text-slate-400">
            {completedIngredients}/{totalIngredients} completados
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {batch.executionIngredients.map((ingredient, index) => (
            <div
              key={ingredient.id}
              className={`rounded-2xl border p-5 ${
                ingredient.completed
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-slate-800 bg-slate-950/50"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Paso {index + 1}
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    {ingredient.name}
                  </p>

                  {ingredient.notes && (
                    <p className="mt-2 text-sm text-slate-500">
                      {ingredient.notes}
                    </p>
                  )}
                </div>

                <p className="text-2xl font-black text-purple-300">
                  {formatNumber(ingredient.scaledQuantity)} {ingredient.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
          Procedimiento
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Instrucciones oficiales
        </h2>

        {batch.recipe.instructions ? (
          <div className="mt-6 whitespace-pre-line rounded-2xl bg-slate-950/60 p-5 leading-7 text-slate-300">
            {batch.recipe.instructions}
          </div>
        ) : (
          <p className="mt-6 text-slate-400">
            Esta receta todavía no tiene instrucciones registradas.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-dashed border-purple-500/30 bg-purple-500/5 p-8 text-center">
        <p className="text-xl font-bold text-white">
          El lote fue creado correctamente
        </p>

        <p className="mt-2 text-slate-400">
          El siguiente paso será convertir esta pantalla en el asistente paso a
          paso para marcar cada ingrediente y cada instrucción.
        </p>
      </section>
    </section>
  );
}

function Kpi({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}