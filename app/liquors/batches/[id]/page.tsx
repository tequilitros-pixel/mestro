import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorBatchAssistant from "@/components/liquors/LiquorBatchAssistant";
import { resumeLiquorBatchAction } from "@/app/actions/liquorBatchPause";

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

      steps: {
        orderBy: {
          position: "asc",
        },
      },

      events: {
        orderBy: {
          createdAt: "asc",
        },
      },

      bottlings: {
        select: {
          producedBottles: true,
          rejectedBottles: true,
        },
      },
    },
  });

  if (!batch) {
    notFound();
  }

  const completedSteps = batch.steps.filter(
    (step) => step.status === "COMPLETADO"
  ).length;

  const totalSteps = batch.steps.length;

  const progress =
    totalSteps > 0
      ? Math.round((completedSteps / totalSteps) * 100)
      : 0;

  const totalProducedBottles = batch.bottlings.reduce(
    (sum, bottling) => sum + bottling.producedBottles,
    0
  );

  const totalRejectedBottles = batch.bottlings.reduce(
    (sum, bottling) => sum + bottling.rejectedBottles,
    0
  );

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
          detail={`${completedSteps} de ${totalSteps} pasos`}
        />
      </section>

     {batch.status === "PAUSADO" ? (
  <section className="mt-6 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 sm:p-8">
    <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">
      ⏸ Elaboración pausada
    </p>

    <h2 className="mt-3 text-3xl font-black text-white">
      El lote está temporalmente detenido
    </h2>

    <div className="mt-6 space-y-4 rounded-2xl border border-amber-500/20 bg-slate-950/40 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Motivo
        </p>

        <p className="mt-1 font-bold text-amber-100">
          {batch.pauseReason ?? "Sin motivo registrado"}
        </p>
      </div>

      {batch.pauseNotes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Observaciones
          </p>

          <p className="mt-1 text-slate-300">
            {batch.pauseNotes}
          </p>
        </div>
      )}

      {batch.pausedAt && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pausado desde
          </p>

          <p className="mt-1 text-slate-300">
            {formatDateTime(batch.pausedAt)}
          </p>
        </div>
      )}
    </div>

    <p className="mt-5 text-sm text-amber-100/70">
      La elaboración debe reanudarse lo antes posible. Mientras el lote esté
      pausado no se podrán completar pasos.
    </p>

    <form action={resumeLiquorBatchAction} className="mt-6">
      <input type="hidden" name="batchId" value={batch.id} />

      <button
        type="submit"
        className="w-full rounded-2xl bg-amber-500 py-4 text-lg font-black text-slate-950 transition hover:bg-amber-400"
      >
        ▶ Reanudar elaboración
      </button>
    </form>
  </section>
) : batch.steps.length > 0 ? (
  <div className="mt-6">
    <LiquorBatchAssistant
      batchId={batch.id}
      steps={batch.steps.map((step) => ({
        id: step.id,
        position: step.position,
        type: step.type,
        status: step.status,
        title: step.title,
        instruction: step.instruction,
        actions: step.actions,
        checks: step.checks,
        plannedQuantity: step.plannedQuantity,
        actualQuantity: step.actualQuantity,
        unit: step.unit,
      }))}
    />
  </div>
) : (
        <section className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
            Procedimiento no disponible
          </p>

          <h2 className="mt-3 text-2xl font-black text-white">
            Este lote no tiene pasos registrados
          </h2>

          <p className="mt-3 text-amber-100/80">
            Este lote probablemente fue creado antes de agregar el procedimiento
            guiado. Crea un lote nuevo para probar las instrucciones completas.
          </p>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
              Resumen del procedimiento
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Pasos del lote
            </h2>
          </div>

          <p className="text-sm text-slate-400">
            {completedSteps}/{totalSteps} completados
          </p>
        </div>

        {batch.steps.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-8 text-center">
            <p className="text-lg font-bold text-white">
              Sin pasos de elaboración
            </p>

            <p className="mt-2 text-slate-400">
              El procedimiento no fue copiado cuando se creó este lote.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {batch.steps.map((step) => {
              const completed = step.status === "COMPLETADO";

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border p-5 ${
                    completed
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-slate-800 bg-slate-950/40"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Paso {step.position} · {formatStepType(step.type)}
                      </p>

                      <p className="mt-1 text-lg font-bold text-white">
                        {step.title}
                      </p>

                      {step.instruction && (
                        <p className="mt-2 max-w-3xl text-sm text-slate-400">
                          {step.instruction}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {step.plannedQuantity !== null && step.unit && (
                        <p className="font-black text-purple-300">
                          {formatNumber(step.plannedQuantity)} {step.unit}
                        </p>
                      )}

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          completed
                            ? "bg-green-500/20 text-green-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {completed ? "Completado" : "Pendiente"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
          Ingredientes del lote
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Cantidades calculadas
        </h2>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {batch.executionIngredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className={`rounded-2xl border p-5 ${
                ingredient.completed
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-slate-800 bg-slate-950/40"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">
                    {ingredient.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Base: {formatNumber(ingredient.baseQuantity)}{" "}
                    {ingredient.unit}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-purple-300">
                    {formatNumber(ingredient.scaledQuantity)}{" "}
                    {ingredient.unit}
                  </p>

                  {ingredient.actualQuantity !== null && (
                    <p className="mt-1 text-xs text-green-300">
                      Real: {formatNumber(ingredient.actualQuantity)}{" "}
                      {ingredient.unit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Kpi
          title="Botellas producidas"
          value={formatNumber(totalProducedBottles, 0)}
          detail="Total embotellado"
        />

        <Kpi
          title="Botellas rechazadas"
          value={formatNumber(totalRejectedBottles, 0)}
          detail="Merma de embotellado"
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
          Historial del lote
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Eventos registrados
        </h2>

        {batch.events.length === 0 ? (
          <p className="mt-6 text-slate-400">
            No existen eventos registrados.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {batch.events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold text-white">
                    {formatEventType(event.type)}
                  </p>

                  <p className="text-xs text-slate-500">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>

                {event.notes && (
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {event.notes}
                  </p>
                )}

                {event.ingredientName && (
                  <p className="mt-2 text-sm text-purple-300">
                    {event.ingredientName}
                    {event.ingredientQuantity !== null &&
                      ` · ${formatNumber(event.ingredientQuantity)}`}
                    {event.ingredientUnit &&
                      ` ${event.ingredientUnit}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
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

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatStepType(type: string) {
  const labels: Record<string, string> = {
    PREPARATION: "Preparación",
    INGREDIENT: "Ingrediente",
    MIXING: "Mezclado",
    WAIT: "Reposo",
    MEASUREMENT: "Medición",
    QUALITY_CHECK: "Control de calidad",
    FINISH: "Finalización",
  };

  return labels[type] ?? "Paso";
}

function formatEventType(type: string) {
  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(date);
}