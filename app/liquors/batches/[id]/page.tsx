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

  /*
   * Se convierte el estado a texto para evitar problemas de TypeScript
   * si el enum tiene un nombre diferente.
   *
   * La tarjeta aparecerá con cualquiera de estos estados.
   */
  const releasedStatuses = [
    "LISTO_PARA_EMBOTELLAR",
    "READY_FOR_BOTTLING",
    "LIBERADO",
    "FINALIZADO",
    "COMPLETADO",
  ];

  const currentStatus = String(batch.status);

const isTerminated = currentStatus === "TERMINADO";

const isReleased = releasedStatuses.includes(currentStatus);

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

                <p className="mt-1 text-slate-300">{batch.pauseNotes}</p>
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
            La elaboración debe reanudarse lo antes posible. Mientras el lote
            esté pausado no se podrán completar pasos.
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
            targetAlcohol={batch.recipe.targetAlcohol}
            plannedLiters={batch.plannedLiters}
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
                  <p className="font-bold text-white">{ingredient.name}</p>

                  <p className="mt-1 text-xs text-slate-500">
                    Base: {formatNumber(ingredient.baseQuantity)}{" "}
                    {ingredient.unit}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-purple-300">
                    {formatNumber(ingredient.scaledQuantity)} {ingredient.unit}
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
{totalProducedBottles > 0 && (
  <section className="mt-6 rounded-3xl border border-purple-500/25 bg-purple-500/10 p-6 sm:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-300">
          Etiquetas disponibles
        </p>

        <h2 className="mt-3 text-2xl font-black text-white">
          🏷️ Imprimir etiquetas de las botellas producidas
        </h2>

        <p className="mt-2 max-w-2xl text-slate-300">
          Este lote tiene {formatNumber(totalProducedBottles, 0)}{" "}
          {totalProducedBottles === 1 ? "botella registrada" : "botellas registradas"}.
          Puedes imprimir sus etiquetas aunque el lote todavía no esté terminado.
        </p>
      </div>

      <Link
        href={`/liquors/batches/${batch.id}/labels`}
        className="shrink-0 rounded-2xl bg-purple-600 px-7 py-4 text-center text-lg font-black text-white transition hover:bg-purple-500"
      >
        🏷️ Ir al centro de impresión
      </Link>
    </div>
  </section>
)}
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
    <section className="mt-6 overflow-hidden rounded-3xl border border-green-500/30 bg-slate-900 shadow-2xl shadow-green-950/20">
      <div className="bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-slate-900 p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/30 bg-green-500/15 text-4xl">
            ✅
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-green-300">
            Lote terminado
          </p>

          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            {productIcon ?? "🍹"} {productName}
          </h2>

          <p className="mt-2 font-mono text-lg font-bold text-green-300">
            {batchCode}
          </p>

          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
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
          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Notas finales
            </p>

            <p className="mt-3 whitespace-pre-wrap text-slate-300">
              {finalNotes}
            </p>
          </div>
        )}

        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
  {totalProducedBottles > 0 && (
    <Link
      href={`/liquors/batches/${batchId}/labels`}
      className="rounded-2xl bg-green-600 px-5 py-4 text-center font-black text-white transition hover:bg-green-500"
    >
      🏷️ Imprimir etiquetas
    </Link>
  )}

  <Link
    href="/liquors/inventory"
    className="rounded-2xl bg-purple-600 px-5 py-4 text-center font-black text-white transition hover:bg-purple-500"
  >
    📦 Ver inventario
  </Link>

  <Link
    href="/liquors/batches"
    className="rounded-2xl border border-slate-700 px-5 py-4 text-center font-black text-slate-200 transition hover:bg-slate-800"
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
    <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-300/70">
        {title}
      </p>

      <p className="mt-3 text-xl font-black text-white">
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
    <section className="mt-6 overflow-hidden rounded-3xl border border-green-500/30 bg-slate-900 shadow-2xl shadow-green-950/20">
      <div className="border-b border-green-500/20 bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/10 px-4 py-2">
              <span className="text-lg">✓</span>

              <p className="text-xs font-black uppercase tracking-[0.3em] text-green-300">
                Lote liberado
              </p>
            </div>

            <h2 className="mt-5 text-3xl font-black text-white sm:text-4xl">
              {productIcon ?? "🍹"} {productName}
            </h2>

            <p className="mt-2 font-mono text-lg font-bold text-green-300">
              {batchCode}
            </p>

            <p className="mt-4 max-w-2xl text-slate-300">
              La elaboración concluyó correctamente y el lote quedó autorizado
              para continuar con el proceso de embotellado.
            </p>
          </div>

          <div className="rounded-3xl border border-green-400/30 bg-green-500/10 px-6 py-5 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-green-300">
              Estado actual
            </p>

            <p className="mt-2 text-xl font-black text-white">
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
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Responsable
            </p>

            <p className="mt-2 text-xl font-black text-white">
              {responsibleName}
            </p>

            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Fecha de liberación
            </p>

            <p className="mt-2 font-semibold text-slate-300">
              {formatDateTime(finishedAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-green-300">
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

        <div className="mt-6 rounded-3xl border border-purple-500/25 bg-purple-500/10 p-6">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-300">
            Próxima etapa
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-2xl font-black text-white">
                🍾 Embotellado
              </h3>

              <p className="mt-2 max-w-2xl text-slate-300">
                Registra las botellas obtenidas, las mermas y la información
                necesaria para generar los códigos QR e ingresar el producto al
                inventario.
              </p>
            </div>

            <Link
              href={`/liquors/batches/${batchId}/bottling`}
              className="shrink-0 rounded-2xl bg-green-600 px-7 py-4 text-center text-lg font-black text-white transition hover:bg-green-500"
            >
              Continuar a embotellado →
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href="#historial-lote"
            className="flex-1 rounded-2xl border border-slate-700 px-5 py-3 text-center font-bold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            Ver historial
          </a>

          <Link
            href="/liquors/batches"
            className="flex-1 rounded-2xl border border-slate-700 px-5 py-3 text-center font-bold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            Volver a lotes
          </Link>

          <Link
  href="/liquors"
  className="flex-1 rounded-2xl border border-slate-700 px-5 py-3 text-center font-bold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-2xl font-black text-white">{value}</p>

      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function VerificationItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-sm font-black text-green-300">
        ✓
      </span>

      <p className="font-semibold text-slate-200">{text}</p>
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