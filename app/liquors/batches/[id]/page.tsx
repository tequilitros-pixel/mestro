import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorBatchAssistant from "@/components/liquors/LiquorBatchAssistant";
import { resumeLiquorBatchAction } from "@/app/actions/liquorBatchPause";
import { TagIcon, PackageIcon, CheckIcon, BottleIcon } from "@/components/ui/icons";

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

  /*
   * Un lote se considera "liberado" (procedimiento de elaboración
   * terminado) tanto si ya está listo para embotellar como si ya
   * tiene uno o más embotellados en curso — en ambos casos debe
   * mostrar la tarjeta de "liberado", no el asistente de pasos.
   */
  const releasedStatuses = ["LISTO_PARA_EMBOTELLAR", "EMBOTELLANDO"];

  const currentStatus = String(batch.status);

const isTerminated = currentStatus === "TERMINADO";

const isReleased = releasedStatuses.includes(currentStatus);

  return (
    <section className="mx-auto max-w-6xl">
      <Link
        href={`/liquors/products/${batch.product.slug}`}
        className="text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Regresar a {batch.product.name}
      </Link>

      <header className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.35em] text-on-surface-variant">
              Orden de elaboración
            </p>

            <h1 className="mt-3 text-4xl font-black text-on-surface sm:text-5xl">
              {batch.product.icon ?? "🍹"} {batch.code}
            </h1>

            <p className="mt-3 text-on-surface-variant">
              {batch.product.name} · {batch.recipe.name} · Versión{" "}
              {batch.recipe.version}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-on-surface-variant">
              Volumen objetivo
            </p>

            <p className="mt-1 text-3xl font-black text-on-surface">
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
              : `${formatNumber(batch.recipe.targetAlcohol)}%`
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

      {isTerminated ? (
  <LiquorBatchFinishedCard
  batchId={batch.id}
  batchCode={batch.code}
  productName={batch.product.name}
  productIcon={batch.product.icon}
  finishedAt={batch.finishedAt ?? batch.updatedAt}
  totalProducedBottles={totalProducedBottles}
  totalRejectedBottles={totalRejectedBottles}
  finalNotes={batch.finalNotes}

  />
) : isReleased ? (
  <LiquorBatchReleasedCard
    batchId={batch.id}
    batchCode={batch.code}
    productName={batch.product.name}
    productIcon={batch.product.icon}
    plannedLiters={batch.plannedLiters}
    targetAlcohol={
      batch.initialAlcohol ?? batch.recipe.targetAlcohol ?? null
    }
    responsibleName={batch.createdBy.name}
    completedSteps={completedSteps}
    totalSteps={totalSteps}
    finishedAt={batch.updatedAt}
    totalProducedBottles={totalProducedBottles}
  />
      ) : batch.status === "PAUSADO" ? (
        <section className="mt-6 rounded-3xl border border-secondary/40 bg-secondary/10 p-6 sm:p-8">
          <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-secondary">
            Elaboración pausada
          </p>

          <h2 className="mt-3 text-3xl font-black text-on-surface">
            El lote está temporalmente detenido
          </h2>

          <div className="mt-6 space-y-4 rounded-2xl border border-secondary/20 bg-surface-dim/40 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                Motivo
              </p>

              <p className="mt-1 font-bold text-secondary">
                {batch.pauseReason ?? "Sin motivo registrado"}
              </p>
            </div>

            {batch.pauseNotes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                  Observaciones
                </p>

                <p className="mt-1 text-on-surface-variant">{batch.pauseNotes}</p>
              </div>
            )}

            {batch.pausedAt && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                  Pausado desde
                </p>

                <p className="mt-1 text-on-surface-variant">
                  {formatDateTime(batch.pausedAt)}
                </p>
              </div>
            )}
          </div>

          <p className="mt-5 text-sm text-secondary/70">
            La elaboración debe reanudarse lo antes posible. Mientras el lote
            esté pausado no se podrán completar pasos.
          </p>

          <form action={resumeLiquorBatchAction} className="mt-6">
            <input type="hidden" name="batchId" value={batch.id} />

            <button
              type="submit"
              className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-on-primary transition duration-150 ease-out hover:scale-[1.02] hover:bg-primary active:scale-[0.98]"
            >
              Reanudar elaboración
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
            targetAlcohol={batch.recipe.targetAlcohol}
            plannedLiters={batch.plannedLiters}
          />
        </div>
      ) : (
        <section className="mt-6 rounded-3xl border border-secondary/30 bg-secondary/10 p-8 text-center">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-secondary">
            Procedimiento no disponible
          </p>

          <h2 className="mt-3 text-2xl font-black text-on-surface">
            Este lote no tiene pasos registrados
          </h2>

          <p className="mt-3 text-secondary/80">
            Este lote probablemente fue creado antes de agregar el procedimiento
            guiado. Crea un lote nuevo para probar las instrucciones completas.
          </p>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
              Resumen del procedimiento
            </p>

            <h2 className="mt-2 text-2xl font-bold text-on-surface">
              Pasos del lote
            </h2>
          </div>

          <p className="text-sm text-on-surface-variant">
            {completedSteps}/{totalSteps} completados
          </p>
        </div>

        {batch.steps.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-outline-variant p-8 text-center">
            <p className="text-lg font-bold text-on-surface">
              Sin pasos de elaboración
            </p>

            <p className="mt-2 text-on-surface-variant">
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
                      ? "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10"
                      : "border-outline-variant bg-surface-dim/40"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                        Paso {step.position} · {formatStepType(step.type)}
                      </p>

                      <p className="mt-1 text-lg font-bold text-on-surface">
                        {step.title}
                      </p>

                      {step.instruction && (
                        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
                          {step.instruction}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {step.plannedQuantity !== null && step.unit && (
                        <p className="font-black text-on-surface">
                          {formatNumber(step.plannedQuantity)} {step.unit}
                        </p>
                      )}

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          completed
                            ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                            : "bg-surface-container-high text-on-surface-variant"
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

      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
          Ingredientes del lote
        </p>

        <h2 className="mt-2 text-2xl font-bold text-on-surface">
          Cantidades calculadas
        </h2>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {batch.executionIngredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className={`rounded-2xl border p-5 ${
                ingredient.completed
                  ? "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10"
                  : "border-outline-variant bg-surface-dim/40"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-on-surface">{ingredient.name}</p>

                  <p className="mt-1 text-xs text-outline">
                    Base: {formatNumber(ingredient.baseQuantity)}{" "}
                    {ingredient.unit}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-on-surface">
                    {formatNumber(ingredient.scaledQuantity)} {ingredient.unit}
                  </p>

                  {ingredient.actualQuantity !== null && (
                    <p className="mt-1 text-xs text-tertiary-fixed-dim">
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
{totalProducedBottles > 0 && (
  <section className="mt-6 rounded-3xl border border-primary/25 bg-primary/[0.06] p-6 sm:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-on-surface-variant">
          Etiquetas disponibles
        </p>

        <h2 className="mt-3 flex items-center gap-2 text-2xl font-black text-on-surface">
          <TagIcon className="h-6 w-6 shrink-0" />
          Imprimir etiquetas de las botellas producidas
        </h2>

        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Este lote tiene {formatNumber(totalProducedBottles, 0)}{" "}
          {totalProducedBottles === 1 ? "botella registrada" : "botellas registradas"}.
          Puedes imprimir sus etiquetas aunque el lote todavía no esté terminado.
        </p>
      </div>

      <Link
        href={`/liquors/batches/${batch.id}/labels`}
        className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-center text-lg font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
      >
        <TagIcon className="h-5 w-5 shrink-0" />
        Ir al centro de impresión
      </Link>
    </div>
  </section>
)}
      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
          Historial del lote
        </p>

        <h2 className="mt-2 text-2xl font-bold text-on-surface">
          Eventos registrados
        </h2>

        {batch.events.length === 0 ? (
          <p className="mt-6 text-on-surface-variant">
            No existen eventos registrados.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {batch.events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold text-on-surface">
                    {formatEventType(event.type)}
                  </p>

                  <p className="text-xs text-outline">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>

                {event.notes && (
                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    {event.notes}
                  </p>
                )}

                {event.ingredientName && (
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {event.ingredientName}
                    {event.ingredientQuantity !== null &&
                      ` · ${formatNumber(event.ingredientQuantity)}`}
                    {event.ingredientUnit && ` ${event.ingredientUnit}`}
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
function LiquorBatchFinishedCard({
  batchId,
  batchCode,
  productName,
  productIcon,
  finishedAt,
  totalProducedBottles,
  totalRejectedBottles,
  finalNotes,
}: {
  batchId: string;
  batchCode: string;
  productName: string;
  productIcon: string | null;
  finishedAt: Date;
  totalProducedBottles: number;
  totalRejectedBottles: number;
  finalNotes: string | null;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container shadow-2xl shadow-tertiary-fixed-dim/20">
      <div className="bg-gradient-to-br from-tertiary-fixed-dim/20 via-tertiary-fixed-dim/10 to-surface-container p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/15">
            <CheckIcon className="h-9 w-9 text-tertiary-fixed-dim" />
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-tertiary-fixed-dim">
            Lote terminado
          </p>

          <h2 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">
            {productIcon ?? "🍹"} {productName}
          </h2>

          <p className="mt-2 font-mono text-lg font-bold text-tertiary-fixed-dim">
            {batchCode}
          </p>

          <p className="mx-auto mt-4 max-w-2xl text-on-surface-variant">
            La elaboración y el embotellado fueron cerrados correctamente.
            Este lote ya no tiene acciones pendientes.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
          <FinishedKpi
            title="Botellas producidas"
            value={formatNumber(totalProducedBottles, 0)}
          />

          <FinishedKpi
            title="Botellas rechazadas"
            value={formatNumber(totalRejectedBottles, 0)}
          />

          <FinishedKpi
            title="Fecha de cierre"
            value={formatDateTime(finishedAt)}
          />
        </div>

        {finalNotes && (
          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-outline">
              Notas finales
            </p>

            <p className="mt-3 whitespace-pre-wrap text-on-surface-variant">
              {finalNotes}
            </p>
          </div>
        )}

        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
  {totalProducedBottles > 0 && (
    <Link
      href={`/liquors/batches/${batchId}/labels`}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-tertiary-fixed-dim px-5 py-4 text-center font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:bg-tertiary-fixed-dim active:scale-[0.97]"
    >
      <TagIcon className="h-5 w-5 shrink-0" />
      Imprimir etiquetas
    </Link>
  )}

  <Link
    href="/liquors/inventory"
    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-center font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
  >
    <PackageIcon className="h-5 w-5 shrink-0" />
    Ver inventario
  </Link>

  <Link
    href="/liquors/batches"
    className="rounded-2xl border border-outline-variant px-5 py-4 text-center font-black text-on-surface transition hover:bg-surface-container-high"
  >
    Volver a lotes
  </Link>
</div>
      </div>
    </section>
  );
}

function FinishedKpi({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 p-5 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-tertiary-fixed-dim/70">
        {title}
      </p>

      <p className="mt-3 text-xl font-black text-on-surface">
        {value}
      </p>
    </div>
  );
}
function LiquorBatchReleasedCard({
  batchId,
  batchCode,
  productName,
  productIcon,
  plannedLiters,
  targetAlcohol,
  responsibleName,
  completedSteps,
  totalSteps,
  finishedAt,
  totalProducedBottles,
}: {
  batchId: string;
  batchCode: string;
  productName: string;
  productIcon: string | null;
  plannedLiters: number;
  targetAlcohol: number | null;
  responsibleName: string;
  completedSteps: number;
  totalSteps: number;
  finishedAt: Date;
  totalProducedBottles: number;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container shadow-2xl shadow-tertiary-fixed-dim/20">
      <div className="border-b border-tertiary-fixed-dim/20 bg-gradient-to-r from-tertiary-fixed-dim/20 via-tertiary-fixed-dim/10 to-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 px-4 py-2">
              <CheckIcon className="h-4 w-4 shrink-0 text-tertiary-fixed-dim" />

              <p className="font-mono text-xs font-black uppercase tracking-[0.3em] text-tertiary-fixed-dim">
                Lote liberado
              </p>
            </div>

            <h2 className="mt-5 text-3xl font-black text-on-surface sm:text-4xl">
              {productIcon ?? "🍹"} {productName}
            </h2>

            <p className="mt-2 font-mono text-lg font-bold text-tertiary-fixed-dim">
              {batchCode}
            </p>

            <p className="mt-4 max-w-2xl text-on-surface-variant">
              La elaboración concluyó correctamente y el lote quedó autorizado
              para continuar con el proceso de embotellado.
            </p>
          </div>

          <div className="rounded-3xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 px-6 py-5 text-center">
            <p className="font-mono text-xs font-black uppercase tracking-[0.25em] text-tertiary-fixed-dim">
              Estado actual
            </p>

            <p className="mt-2 text-xl font-black text-on-surface">
              Listo para embotellar
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReleasedKpi
            title="Volumen del lote"
            value={`${formatNumber(plannedLiters)} L`}
            detail="Volumen registrado"
          />

          <ReleasedKpi
            title="Alcohol"
            value={
              targetAlcohol !== null
                ? `${formatNumber(targetAlcohol)}%`
                : "No registrado"
            }
            detail="Graduación del producto"
          />

          <ReleasedKpi
            title="Pasos completados"
            value={`${completedSteps}/${totalSteps}`}
            detail="Procedimiento terminado"
          />

          <ReleasedKpi
            title="Botellas producidas"
            value={formatNumber(totalProducedBottles, 0)}
            detail={
              totalProducedBottles > 0
                ? "Embotellado registrado"
                : "Pendiente de embotellar"
            }
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-outline">
              Responsable
            </p>

            <p className="mt-2 text-xl font-black text-on-surface">
              {responsibleName}
            </p>

            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-outline">
              Fecha de liberación
            </p>

            <p className="mt-2 font-semibold text-on-surface-variant">
              {formatDateTime(finishedAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/5 p-5">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-tertiary-fixed-dim">
              Verificación
            </p>

            <div className="mt-4 space-y-3">
              <VerificationItem text="Procedimiento completado" />
              <VerificationItem text="Ingredientes registrados" />
              <VerificationItem text="Lote identificado" />
              <VerificationItem text="Liberado para embotellado" />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-primary/25 bg-primary/[0.06] p-6">
          <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-on-surface-variant">
            Próxima etapa
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-2xl font-black text-on-surface">
                <BottleIcon className="h-6 w-6 shrink-0" />
                Embotellado
              </h3>

              <p className="mt-2 max-w-2xl text-on-surface-variant">
                Registra las botellas obtenidas, las mermas y la información
                necesaria para generar los códigos QR e ingresar el producto al
                inventario.
              </p>
            </div>

            <Link
              href={`/liquors/batches/${batchId}/bottling`}
              className="shrink-0 rounded-2xl bg-tertiary-fixed-dim px-7 py-4 text-center text-lg font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:bg-tertiary-fixed-dim active:scale-[0.97]"
            >
              Continuar a embotellado →
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href="#historial-lote"
            className="flex-1 rounded-2xl border border-outline-variant px-5 py-3 text-center font-bold text-on-surface-variant transition hover:border-outline-variant hover:bg-surface-container-high"
          >
            Ver historial
          </a>

          <Link
            href="/liquors/batches"
            className="flex-1 rounded-2xl border border-outline-variant px-5 py-3 text-center font-bold text-on-surface-variant transition hover:border-outline-variant hover:bg-surface-container-high"
          >
            Volver a lotes
          </Link>

          <Link
  href="/liquors"
  className="flex-1 rounded-2xl border border-outline-variant px-5 py-3 text-center font-bold text-on-surface-variant transition hover:border-outline-variant hover:bg-surface-container-high"
>
  Crear nuevo lote
</Link>
        </div>
      </div>
    </section>
  );
}

function ReleasedKpi({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-outline">
        {title}
      </p>

      <p className="mt-3 text-2xl font-black text-on-surface">{value}</p>

      <p className="mt-2 text-xs text-outline">{detail}</p>
    </div>
  );
}

function VerificationItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>

      <p className="font-semibold text-on-surface">{text}</p>
    </div>
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
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-2 text-2xl font-black text-on-surface">{value}</p>
      <p className="mt-2 text-xs text-outline">{detail}</p>
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